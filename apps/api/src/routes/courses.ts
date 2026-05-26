import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments } from "../db/schema";
import {
  courseCodeParamSchema,
  courseCreateSchema,
  courseValidationHook,
} from "../validators";

type CourseRow = typeof courses.$inferSelect;
type EnrollmentRow = typeof enrollments.$inferSelect;

type CourseCatalogRow = CourseRow & {
  code: string;
  prerequisiteCodes: string[];
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

function getActiveEnrollmentCount(rows: EnrollmentRow[]) {
  return rows.filter(
    (row) =>
      row.status === "ongoing" ||
      row.status === "completed" ||
      row.status === "finalized",
  ).length;
}

function toCourseCatalogRow(
  row: CourseRow,
  enrolledCount = 0,
): CourseCatalogRow {
  return {
    ...row,
    code: row.id,
    prerequisiteCodes: row.prerequisites ?? [],
    enrolledCount,
    remainingSeats: Math.max(row.capacity - enrolledCount, 0),
  };
}

async function loadCourseCatalog(db: ReturnType<typeof drizzle>) {
  const [courseRows, enrollmentRows] = await Promise.all([
    db.select().from(courses).all(),
    db.select().from(enrollments).all(),
  ]);

  const counts = new Map<string, number>();

  for (const row of enrollmentRows) {
    if (
      row.status !== "ongoing" &&
      row.status !== "completed" &&
      row.status !== "finalized"
    ) {
      continue;
    }

    counts.set(row.courseId, (counts.get(row.courseId) ?? 0) + 1);
  }

  return courseRows.map((row) => toCourseCatalogRow(row, counts.get(row.id)));
}

export const coursesRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

coursesRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const coursesPayload = await loadCourseCatalog(db);

  return c.json(coursesPayload);
});

coursesRoutes.get(
  "/:code/availability",
  zValidator("param", courseCodeParamSchema, courseValidationHook),
  async (c) => {
    const { code } = c.req.valid("param");
    const db = drizzle(c.env.DB);

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, code))
      .get();

    if (!course) {
      return c.json({ message: "Course not found" }, 404);
    }

    const enrolledRows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.courseId, course.id))
      .all();
    const enrolledCount = getActiveEnrollmentCount(enrolledRows);
    const remainingSeats = Math.max(course.capacity - enrolledCount, 0);

    return c.json({
      course: toCourseCatalogRow(course, enrolledCount),
      enrolledCount,
      remainingSeats,
      hasCapacity: remainingSeats > 0,
    });
  },
);

coursesRoutes.post(
  "/",
  requireAuth,
  requireAdmin,
  zValidator("json", courseCreateSchema, courseValidationHook),
  async (c) => {
    const {
      id,
      title,
      description,
      capacity,
      labCredits,
      lecCredits,
      prerequisites,
    } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    const existingCourse = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .get();

    if (existingCourse) {
      return c.json(
        {
          success: false,
          error: "Course code already exists.",
          field: "courseCode",
        },
        409,
      );
    }

    await db
      .insert(courses)
      .values({
        id,
        title,
        description: description ?? null,
        capacity,
        labCredits,
        lecCredits,
        instructorId: null,
        prerequisites,
      })
      .run();

    const createdCourse = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .get();

    if (!createdCourse) {
      return c.json(
        { success: false, error: "Course creation failed.", field: "course" },
        500,
      );
    }

    return c.json({ course: toCourseCatalogRow(createdCourse) }, 201);
  },
);
