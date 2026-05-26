import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import {
  courses,
  enrollments,
  sections,
  users,
  type SectionScheduleEntry,
} from "../db/schema";
import { sectionCreateSchema, sectionValidationHook } from "../validators";
import { schedulesOverlap } from "../utils/time";

type CourseRow = typeof courses.$inferSelect;
type SectionRow = typeof sections.$inferSelect;
type UserRow = typeof users.$inferSelect;

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value) return [] as unknown[];

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as unknown[];
  }
}

function normalizeScheduleSlots(value: unknown): SectionScheduleEntry[] {
  return parseJsonArray(value)
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const slot = entry as Partial<SectionScheduleEntry>;

      if (typeof slot.day !== "string" || typeof slot.time !== "string") {
        return null;
      }

      return {
        day: slot.day.trim(),
        time: slot.time.trim(),
        type: typeof slot.type === "string" ? slot.type.trim() : "",
      } satisfies SectionScheduleEntry;
    })
    .filter(
      (slot): slot is SectionScheduleEntry =>
        slot !== null && Boolean(slot.day && slot.time),
    );
}

type SectionCatalogRow = SectionRow & {
  courseCode: string;
  courseTitle: string;
  instructorName: string;
  enrolledCount: number;
  remainingSeats: number;
};

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

    // 1. VALIDATE SCHEDULE OVERLAP WITHIN THE SAME SECTION NAME
    const incomingSlots = normalizeScheduleSlots(scheduleArray);

    if (incomingSlots.length > 0) {
      // Find other sections with the same name
      const sameNamedSections = await db
        .select()
        .from(sections)
        .where(eq(sections.sectionName, sectionName))
        .all();

      for (const existingSection of sameNamedSections) {
        const existingSlots = normalizeScheduleSlots(
          existingSection.scheduleArray,
        );

        for (const incomingSlot of incomingSlots) {
          const conflict = existingSlots.find((existingSlot) =>
            schedulesOverlap(incomingSlot, existingSlot),
          );

          if (conflict) {
            return c.json(
              {
                success: false,
                error: `Schedule Conflict: This section already has a subject scheduled during this timeslot (${conflict.day} ${conflict.time}).`,
              },
              400,
            );
          }
        }
      }
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
