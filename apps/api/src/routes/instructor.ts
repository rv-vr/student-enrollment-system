import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, sections, users } from "../db/schema";

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

export const instructorRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

instructorRoutes.use("*", requireAuth);

instructorRoutes.get("/classes", async (c) => {
  const user = c.get("user");

  if (user.role !== "instructor") {
    return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
  }

  const db = drizzle(c.env.DB);
  const assignedSections = await db
    .select()
    .from(sections)
    .where(eq(sections.instructorId, user.id))
    .all();

  const payload = await Promise.all(
    assignedSections.map(async (section: SectionRow) => {
      const course = await db
        .select()
        .from(courses)
        .where(eq(courses.id, section.courseId))
        .get();
      if (!course) {
        return null;
      }

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
            return buildRosterEntry(row, studentRow);
        }),
      );

      return {
          section: {
            ...section,
          },
        course: {
          ...course,
          prerequisites: parseJsonArray(course.prerequisites),
        },
        roster,
      };
    }),
  );

    return c.json({ classes: payload.filter(Boolean) });
});
