import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, notifications, sections, users } from "../db/schema";
import { studentIdParamSchema, studentValidationHook } from "../validators";

type CourseRow = typeof courses.$inferSelect;
type EnrollmentRow = typeof enrollments.$inferSelect;
type NotificationRow = typeof notifications.$inferSelect;
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

function buildEnrollmentViewRow(
  row: EnrollmentRow,
  courseRow?: CourseRow,
  sectionRow?: SectionRow,
  studentRow?: UserRow,
) {
  return {
    id: row.id,
    userId: row.userId,
    studentId: row.userId,
    courseId: row.courseId,
    courseCode: row.courseId,
    status: row.status,
    sectionId: row.sectionId,
    section: sectionRow?.sectionName ?? null,
    instructorId: sectionRow?.instructorId ?? null,
    scheduleArray: sectionRow?.scheduleArray ?? [],
    dateEnrolled: row.dateEnrolled,
    dateRequested: row.dateRequested,
    grade: row.grade,
    remark: row.remark,
    student: studentRow
      ? {
          id: studentRow.id,
          username: studentRow.username,
          name: studentRow.name,
        }
      : null,
    course: courseRow
      ? { ...courseRow, prerequisites: parseJsonArray(courseRow.prerequisites) }
      : null,
  };
}

export const studentsRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

studentsRoutes.use("*", requireAuth);

studentsRoutes.get(
  "/:id/courses",
  zValidator("param", studentIdParamSchema, studentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const db = drizzle(c.env.DB);

    if (user.role === "student" && user.id !== id) {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const student = await db.select().from(users).where(eq(users.id, id)).get();
    if (!student) return c.json({ message: "Student not found" }, 404);

    const enrollRows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.userId, id))
      .all();

    const enrollmentsView = await Promise.all(
      enrollRows.map(async (row) => {
        const courseRow = await db
          .select()
          .from(courses)
          .where(eq(courses.id, row.courseId))
          .get();
        const sectionRow = await db
          .select()
          .from(sections)
          .where(eq(sections.id, row.sectionId))
          .get();
        return buildEnrollmentViewRow(row, courseRow, sectionRow, student);
      }),
    );

    const completedCourses = enrollRows
      .filter((row) => row.status === "completed")
      .map((row) => row.courseId);

    return c.json({ student, completedCourses, enrollments: enrollmentsView });
  },
);

studentsRoutes.get(
  "/:id/notifications",
  zValidator("param", studentIdParamSchema, studentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const db = drizzle(c.env.DB);

    if (user.role === "student" && user.id !== id) {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const student = await db.select().from(users).where(eq(users.id, id)).get();
    if (!student) return c.json({ message: "Student not found" }, 404);

    const notificationRows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, id))
      .all();

    return c.json({
      student,
      notifications: notificationRows.map((row: NotificationRow) => ({
        ...row,
        isRead: Boolean(row.isRead),
      })),
    });
  },
);
