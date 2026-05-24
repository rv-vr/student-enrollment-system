import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import {
  dropSchema,
  enrollSchema,
  enrollmentValidationHook,
  gradeSchema,
} from "../validators";
import { isPassingGrade } from "../store";
import { getDbFromBindings } from "../db";
import { drizzle } from "drizzle-orm/d1";
import { users, courses, enrollments } from "../db/schema";
import { eq, and } from "drizzle-orm";

function buildEnrollmentViewRow(row: any, courseRow: any, studentRow: any, instructorRow: any) {
  return {
    id: row.id,
    studentId: row.student_id,
    courseCode: courseRow?.code ?? row.course_code,
    status: row.status,
    section: studentRow?.section ?? null,
    instructorId: courseRow?.instructor_id ?? null,
    grade: row.grade,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    student: studentRow ? { id: studentRow.id, name: studentRow.name } : null,
    course: courseRow
      ? {
          ...courseRow,
          prerequisiteCodes: courseRow.prerequisiteCodes ?? [],
        }
      : null,
    instructor: instructorRow ? { id: instructorRow.id, name: instructorRow.name } : null,
  };
}

export const enrollmentsRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

enrollmentsRoutes.use("*", requireAuth);

enrollmentsRoutes.post(
  "/enroll",
  zValidator("json", enrollSchema, enrollmentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { studentId, courseCode } = c.req.valid("json");

    const db = drizzle(c.env.DB);

    if (user.role !== "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    if (user.id !== studentId) {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const student = await db.select().from(users).where(eq(users.id, studentId)).get();

    if (!student) return c.json({ message: "Student not found" }, 404);

    const course = await db.select().from(courses).where(eq(courses.code, courseCode)).get();

    if (!course) return c.json({ message: "Course not found" }, 404);

    // check passed
    const passed = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.student_id, studentId), eq(enrollments.course_id, course.id), eq(enrollments.status, 'approved')))
      .limit(1)
      .all();

    if (passed.length > 0) return c.json({ message: "Student already passed this course" }, 409);

    // active enrollment
    const active = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.student_id, studentId), eq(enrollments.course_id, course.id)))
      .limit(1)
      .all();

    if (active.length > 0) return c.json({ message: "Student already enrolled in this course" }, 409);

    // remaining seats
    const approvedCount = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.course_id, course.id), eq(enrollments.status, 'approved')))
      .all();

    const remainingSeats = Math.max((course.capacity ?? 0) - approvedCount.length, 0);

    if (remainingSeats <= 0) return c.json({ message: "Course is full" }, 409);

    // prerequisites: not modeled in D1 schema currently — assume satisfied

    // insert enrollment
    const id = crypto.randomUUID();
    await db.insert(enrollments).values({ id, student_id: studentId, course_id: course.id, status: 'pending', grade: null }).run();

    const enrollmentRow = await db.select().from(enrollments).where(eq(enrollments.id, id)).get();

    return c.json(
      {
        message: "Enrollment request submitted",
        enrollment: buildEnrollmentViewRow(enrollmentRow, course, student, null),
        availability: {
          capacity: course.capacity,
          enrolledCount: (course.capacity ?? 0) - remainingSeats,
          remainingSeats,
        },
      },
      201,
    );
  },
);

enrollmentsRoutes.post(
  "/drop",
  zValidator("json", dropSchema, enrollmentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { studentId, courseCode } = c.req.valid("json");

    if (user.role !== "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    if (user.id !== studentId) {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const db = drizzle(c.env.DB);
    const course = await db.select().from(courses).where(eq(courses.code, courseCode)).get();
    if (!course) return c.json({ message: "Course not found" }, 404);

    const enrollmentRow = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.student_id, studentId), eq(enrollments.course_id, course.id)))
      .get();

    if (!enrollmentRow) return c.json({ message: "Enrollment not found" }, 404);

    await db.delete(enrollments).where(eq(enrollments.id, enrollmentRow.id)).run();

    const approvedCount = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.course_id, course.id), eq(enrollments.status, 'approved')))
      .all();

    const remainingSeats = Math.max((course.capacity ?? 0) - approvedCount.length, 0);

    return c.json({
      message: "Enrollment dropped",
      enrollment: buildEnrollmentViewRow(enrollmentRow, course, { id: studentId, name: null }, null),
      availability: {
        capacity: course.capacity,
        enrolledCount: (course.capacity ?? 0) - remainingSeats,
        remainingSeats,
      },
    });
  },
);

// Patch grade by enrollmentId in body - keep backward compatibility
enrollmentsRoutes.patch(
  "/grade",
  zValidator("json", gradeSchema, enrollmentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { enrollmentId, grade } = c.req.valid("json");

    if (user.role === "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const db = drizzle(c.env.DB);
    const enrollmentRow = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).get();
    if (!enrollmentRow) return c.json({ message: "Enrollment not found" }, 404);

    const courseRow = await db.select().from(courses).where(eq(courses.id, enrollmentRow.course_id)).get();
    const ownerId = courseRow?.instructor_id ?? null;

    if (user.role === "instructor" && user.id !== ownerId) {
      return c.json({ success: false, error: "Access Denied", field: "auth" }, 403);
    }

    await db.update(enrollments).set({ grade }).where(eq(enrollments.id, enrollmentId)).run();

    const updated = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).get();

    return c.json({
      message: updated.grade === null ? "Grade cleared" : isPassingGrade(updated.grade) ? "Passing grade recorded" : "Grade recorded",
      enrollment: buildEnrollmentViewRow(updated, courseRow, null, null),
    });
  },
);

// New route: PATCH /enrollments/:id/grade — grade by path param (secure + validate)
import { z } from "zod";

const gradeOnlySchema = z.object({
  grade: z.union([z.number().min(1).max(5), z.null()]),
});

enrollmentsRoutes.patch(
  "/enrollments/:id/grade",
  zValidator("json", gradeOnlySchema, enrollmentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.param();
    const { grade } = c.req.valid("json") as { grade: number | null };

    if (user.role === "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const db = drizzle(c.env.DB);
    const enrollmentRow = await db.select().from(enrollments).where(eq(enrollments.id, id)).get();
    if (!enrollmentRow) return c.json({ message: "Enrollment not found" }, 404);

    const courseRow = await db.select().from(courses).where(eq(courses.id, enrollmentRow.course_id)).get();
    const ownerId = courseRow?.instructor_id ?? null;

    if (user.role === "instructor" && user.id !== ownerId) {
      return c.json({ success: false, error: "Access Denied", field: "auth" }, 403);
    }

    await db.update(enrollments).set({ grade }).where(eq(enrollments.id, id)).run();

    const updated = await db.select().from(enrollments).where(eq(enrollments.id, id)).get();

    return c.json({
      message: updated.grade === null ? "Grade cleared" : isPassingGrade(updated.grade) ? "Passing grade recorded" : "Grade recorded",
      enrollment: buildEnrollmentViewRow(updated, courseRow, null, null),
    });
  },
);
