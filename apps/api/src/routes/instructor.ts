import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, users } from "../db/schema";

type CourseRow = typeof courses.$inferSelect;
type EnrollmentRow = typeof enrollments.$inferSelect;
type UserRow = typeof users.$inferSelect;

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [] as unknown[];

  try {
    const parsed = JSON.parse(value);
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
    status: row.status,
    section: row.section,
    scheduleArray: parseJsonArray(row.scheduleArray),
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
  const assignedCourses = await db
    .select()
    .from(courses)
    .where(eq(courses.instructorId, user.id))
    .all();

  const payload = await Promise.all(
    assignedCourses.map(async (course: CourseRow) => {
      const rosterRows = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.courseId, course.id))
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
        course: {
          ...course,
          prerequisites: parseJsonArray(course.prerequisites),
        },
        roster,
      };
    }),
  );

  return c.json({ classes: payload });
});
