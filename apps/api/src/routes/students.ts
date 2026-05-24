import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { studentIdParamSchema, studentValidationHook } from "../validators";
import { drizzle } from "drizzle-orm/d1";
import { users, enrollments, courses } from "../db/schema";
import { eq } from "drizzle-orm";

function buildEnrollmentViewRow(row: any, courseRow: any, studentRow: any) {
  return {
    id: row.id,
    studentId: row.student_id,
    courseCode: courseRow?.code ?? null,
    status: row.status,
    grade: row.grade,
    student: studentRow ? { id: studentRow.id, name: studentRow.name } : null,
    course: courseRow
      ? {
          ...courseRow,
          prerequisiteCodes: courseRow.prerequisiteCodes ?? [],
        }
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

    const enrollRows = await db.select().from(enrollments).where(eq(enrollments.student_id, id)).all();

    const enrollmentsView = await Promise.all(
      enrollRows.map(async (row) => {
        const courseRow = await db.select().from(courses).where(eq(courses.id, row.course_id)).get();
        return buildEnrollmentViewRow(row, courseRow, student);
      }),
    );

    // completed courses: those with approved status and passing grade
    const completed = enrollRows.filter((r) => r.status === 'approved' && r.grade !== null && r.grade <= 3.0).map((r) => r.course_id);

    return c.json({ student, completedCourses: completed, enrollments: enrollmentsView });
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

    // notifications table not present in schema; return empty list for now
    return c.json({ student, notifications: [] });
  },
);
