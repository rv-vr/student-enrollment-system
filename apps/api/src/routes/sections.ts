import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, sections, users } from "../db/schema";
import { sectionCreateSchema, sectionValidationHook } from "../validators";

type CourseRow = typeof courses.$inferSelect;
type SectionRow = typeof sections.$inferSelect;
type UserRow = typeof users.$inferSelect;

type SectionCatalogRow = SectionRow & {
  courseCode: string;
  courseTitle: string;
  instructorName: string;
  enrolledCount: number;
  remainingSeats: number;
};

const requireAdmin = createMiddleware<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const user = c.get("user");

  if (user.role !== "admin") {
    return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
  }

  await next();
});

function toSectionCatalogRow(
  sectionRow: SectionRow,
  courseRow: CourseRow,
  instructorRow: UserRow,
  enrolledCount: number,
): SectionCatalogRow {
  return {
    ...sectionRow,
    courseCode: courseRow.id,
    courseTitle: courseRow.title,
    instructorName: instructorRow.name,
    enrolledCount,
    remainingSeats: Math.max(sectionRow.capacity - enrolledCount, 0),
  };
}

export const sectionsRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

sectionsRoutes.use("*", requireAuth);

sectionsRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB);

  const rows = await db
    .select({ section: sections, course: courses, instructor: users })
    .from(sections)
    .innerJoin(courses, eq(sections.courseId, courses.id))
    .innerJoin(users, eq(sections.instructorId, users.id))
    .all();

  const enrollmentRows = await db.select().from(enrollments).all();
  const counts = new Map<string, number>();

  for (const row of enrollmentRows) {
    if (row.status !== "ongoing" && row.status !== "completed") {
      continue;
    }

    counts.set(row.sectionId, (counts.get(row.sectionId) ?? 0) + 1);
  }

  const payload = rows.map(({ section, course, instructor }) =>
    toSectionCatalogRow(
      section,
      course,
      instructor,
      counts.get(section.id) ?? 0,
    ),
  );

  return c.json({ sections: payload });
});

sectionsRoutes.post(
  "/",
  requireAdmin,
  zValidator("json", sectionCreateSchema, sectionValidationHook),
  async (c) => {
    const { courseCode, instructorId, sectionName, capacity, scheduleArray } =
      c.req.valid("json");
    const db = drizzle(c.env.DB);

    const courseRow = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseCode))
      .get();
    if (!courseRow) {
      return c.json(
        { success: false, error: "Course not found", field: "courseCode" },
        404,
      );
    }

    const instructorRow = await db
      .select()
      .from(users)
      .where(eq(users.id, instructorId))
      .get();
    if (!instructorRow || instructorRow.role !== "instructor") {
      return c.json(
        {
          success: false,
          error: "Instructor not found",
          field: "instructorId",
        },
        404,
      );
    }

    const sectionId = crypto.randomUUID();

    await db
      .insert(sections)
      .values({
        id: sectionId,
        courseId: courseRow.id,
        instructorId: instructorRow.id,
        sectionName,
        capacity,
        scheduleArray,
      })
      .run();

    const createdSection = await db
      .select({ section: sections, course: courses, instructor: users })
      .from(sections)
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(users, eq(sections.instructorId, users.id))
      .where(eq(sections.id, sectionId))
      .get();

    if (!createdSection) {
      return c.json(
        { success: false, error: "Section creation failed.", field: "section" },
        500,
      );
    }

    return c.json(
      {
        section: toSectionCatalogRow(
          createdSection.section,
          createdSection.course,
          createdSection.instructor,
          0,
        ),
      },
      201,
    );
  },
);
