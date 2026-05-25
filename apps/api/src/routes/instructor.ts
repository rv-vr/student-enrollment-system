import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, sections, users } from "../db/schema";
import { enrollmentValidationHook, instructorGradeUpdateSchema } from "../validators";
import { zValidator } from "@hono/zod-validator";

type SectionCatalogRow = typeof sections.$inferSelect & {
  courseCode: string;
  courseTitle: string;
  enrolledCount: number;
  remainingSeats: number;
};

type CourseRow = typeof courses.$inferSelect;
type EnrollmentRow = typeof enrollments.$inferSelect;
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

function buildRosterEntry(row: EnrollmentRow, studentRow?: UserRow) {
  return {
    id: row.id,
    userId: row.userId,
    studentId: row.userId,
    courseId: row.courseId,
    sectionId: row.sectionId,
    status: row.status,
    section: null,
    scheduleArray: [],
    dateRequested: row.dateRequested,
    dateEnrolled: row.dateEnrolled,
    grade: row.grade,
    remark: row.remark,
    student: studentRow
      ? {
          id: studentRow.id,
          username: studentRow.username,
          name: studentRow.name,
        }
      : null,
  };
}

function toInstructorSectionRow(
  sectionRow: SectionRow,
  courseRow: CourseRow,
  enrolledCount: number,
): SectionCatalogRow {
  return {
    ...sectionRow,
    courseCode: courseRow.id,
    courseTitle: courseRow.title,
    enrolledCount,
    remainingSeats: Math.max(sectionRow.capacity - enrolledCount, 0),
  };
}

function normalizeGradeInput(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);

  if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
    return numericValue;
  }

  const letterGrades: Record<string, number> = {
    "A+": 4,
    A: 4,
    "A-": 3.7,
    "B+": 3.3,
    B: 3,
    "B-": 2.7,
    "C+": 2.3,
    C: 2,
    "C-": 1.7,
    "D+": 1.3,
    D: 1,
    "D-": 0.7,
    F: 0,
  };

  return letterGrades[normalized] ?? null;
}

export const instructorRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

instructorRoutes.use("*", requireAuth);

async function loadInstructorSections(c: Parameters<typeof instructorRoutes.get>[1] extends (
  ...args: infer T
) => unknown
  ? T[0]
  : never) {
  const user = c.get("user");

  if (user.role !== "instructor") {
    return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
  }

  const db = drizzle(c.env.DB);
  const sectionRows = await db
    .select({ section: sections, course: courses })
    .from(sections)
    .innerJoin(courses, eq(sections.courseId, courses.id))
    .where(eq(sections.instructorId, user.id))
    .all();

  const enrollmentRows = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.status, "ongoing"))
    .all();

  const activeCounts = new Map<string, number>();

  for (const row of enrollmentRows) {
    activeCounts.set(row.sectionId, (activeCounts.get(row.sectionId) ?? 0) + 1);
  }

  const payload = await Promise.all(
    sectionRows.map(async ({ section, course }) => {
      const rosterRows = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.sectionId, section.id))
        .all();

      const roster = await Promise.all(
        rosterRows.map(async (row: EnrollmentRow) => {
          const studentRow = await db
            .select()
            .from(users)
            .where(eq(users.id, row.userId))
            .get();

          return buildRosterEntry(row, studentRow ?? undefined);
        }),
      );

      return {
        section: toInstructorSectionRow(
          section,
          {
            ...course,
            prerequisites: parseJsonArray(course.prerequisites),
          },
          activeCounts.get(section.id) ?? 0,
        ),
        course: {
          ...course,
          prerequisites: parseJsonArray(course.prerequisites),
        },
        roster,
      };
    }),
  );

  return c.json({ sections: payload });
}

instructorRoutes.get("/sections", loadInstructorSections);
instructorRoutes.get("/classes", loadInstructorSections);
