import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, users } from "../db/schema";
import {
  dropSchema,
  enrollSchema,
  enrollmentValidationHook,
  gradeSchema,
} from "../validators";
import { isPassingGrade } from "../store";

type EnrollmentRow = typeof enrollments.$inferSelect;
type CourseRow = typeof courses.$inferSelect;
type UserRow = typeof users.$inferSelect;

function parseJsonArray(value: string | null | undefined) {
  if (!value) {
    return [] as unknown[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as unknown[];
  }
}

function buildEnrollmentViewRow(
  row: EnrollmentRow,
  courseRow?: CourseRow,
  studentRow?: UserRow,
  instructorRow?: UserRow,
) {
  return {
    id: row.id,
    userId: row.userId,
    studentId: row.userId,
    courseId: row.courseId,
    courseCode: row.courseId,
    status: row.status,
    section: row.section,
    instructorId: row.instructorId,
    scheduleArray: parseJsonArray(row.scheduleArray),
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
      ? {
          ...courseRow,
          prerequisites: parseJsonArray(courseRow.prerequisites),
        }
      : null,
    instructor: instructorRow
      ? {
          id: instructorRow.id,
          username: instructorRow.username,
          name: instructorRow.name,
        }
      : null,
  };
}

function getActiveSeatCount(rows: EnrollmentRow[]) {
  return rows.filter(
    (row) => row.status === "ongoing" || row.status === "completed",
  ).length;
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

    const student = await db
      .select()
      .from(users)
      .where(eq(users.id, studentId))
      .get();
    if (!student) return c.json({ message: "Student not found" }, 404);

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseCode))
      .get();
    if (!course) return c.json({ message: "Course not found" }, 404);

    const existing = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, studentId),
          eq(enrollments.courseId, course.id),
        ),
      )
      .all();

    if (existing.length > 0) {
      return c.json(
        { message: "Student already enrolled in this course" },
        409,
      );
    }

    const approvedRows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.courseId, course.id))
      .all();

    const remainingSeats = Math.max(
      course.capacity - getActiveSeatCount(approvedRows),
      0,
    );
    if (remainingSeats <= 0) return c.json({ message: "Course is full" }, 409);

    const enrollmentId = crypto.randomUUID();
    const requestedAt = new Date().toISOString();

    await db
      .insert(enrollments)
      .values({
        id: enrollmentId,
        status: "pending",
        courseId: course.id,
        userId: student.id,
        instructorId: course.instructorId,
        section: "Main",
        scheduleArray: JSON.stringify([]),
        dateEnrolled: null,
        dateRequested: requestedAt,
        grade: null,
        remark: null,
      })
      .run();

    const enrollmentRow = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .get();

    return c.json(
      {
        message: "Enrollment request submitted",
        enrollment: buildEnrollmentViewRow(
          enrollmentRow,
          course,
          student,
          undefined,
        ),
        availability: {
          capacity: course.capacity,
          enrolledCount: course.capacity - remainingSeats,
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
    const db = drizzle(c.env.DB);

    if (user.role !== "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    if (user.id !== studentId) {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseCode))
      .get();
    if (!course) return c.json({ message: "Course not found" }, 404);

    const enrollmentRow = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, studentId),
          eq(enrollments.courseId, course.id),
        ),
      )
      .get();

    if (!enrollmentRow) return c.json({ message: "Enrollment not found" }, 404);

    await db
      .delete(enrollments)
      .where(eq(enrollments.id, enrollmentRow.id))
      .run();
    const studentRow = await db
      .select()
      .from(users)
      .where(eq(users.id, studentId))
      .get();

    const activeRows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.courseId, course.id))
      .all();
    const remainingSeats = Math.max(
      course.capacity - getActiveSeatCount(activeRows),
      0,
    );

    return c.json({
      message: "Enrollment dropped",
      enrollment: buildEnrollmentViewRow(
        enrollmentRow,
        course,
        studentRow,
        undefined,
      ),
      availability: {
        capacity: course.capacity,
        enrolledCount: course.capacity - remainingSeats,
        remainingSeats,
      },
    });
  },
);

enrollmentsRoutes.patch(
  "/grade",
  zValidator("json", gradeSchema, enrollmentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { enrollmentId, grade } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    if (user.role === "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const enrollmentRow = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .get();
    if (!enrollmentRow) return c.json({ message: "Enrollment not found" }, 404);

    const courseRow = await db
      .select()
      .from(courses)
      .where(eq(courses.id, enrollmentRow.courseId))
      .get();
    const ownerId = enrollmentRow.instructorId;

    if (user.role === "instructor" && user.id !== ownerId) {
      return c.json(
        { success: false, error: "Access Denied", field: "auth" },
        403,
      );
    }

    const nextStatus =
      grade === null ? "ongoing" : isPassingGrade(grade) ? "completed" : "inc";

    await db
      .update(enrollments)
      .set({ grade, status: nextStatus })
      .where(eq(enrollments.id, enrollmentId))
      .run();

    const updated = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .get();

    return c.json({
      message:
        updated.grade === null
          ? "Grade cleared"
          : isPassingGrade(updated.grade)
            ? "Passing grade recorded"
            : "Grade recorded",
      enrollment: buildEnrollmentViewRow(
        updated,
        courseRow,
        undefined,
        undefined,
      ),
    });
  },
);

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
    const db = drizzle(c.env.DB);

    if (user.role === "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const enrollmentRow = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .get();
    if (!enrollmentRow) return c.json({ message: "Enrollment not found" }, 404);

    const courseRow = await db
      .select()
      .from(courses)
      .where(eq(courses.id, enrollmentRow.courseId))
      .get();
    const ownerId = enrollmentRow.instructorId;

    if (user.role === "instructor" && user.id !== ownerId) {
      return c.json(
        { success: false, error: "Access Denied", field: "auth" },
        403,
      );
    }

    const nextStatus =
      grade === null ? "ongoing" : isPassingGrade(grade) ? "completed" : "inc";

    await db
      .update(enrollments)
      .set({ grade, status: nextStatus })
      .where(eq(enrollments.id, id))
      .run();

    const updated = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .get();

    return c.json({
      message:
        updated.grade === null
          ? "Grade cleared"
          : isPassingGrade(updated.grade)
            ? "Passing grade recorded"
            : "Grade recorded",
      enrollment: buildEnrollmentViewRow(
        updated,
        courseRow,
        undefined,
        undefined,
      ),
    });
  },
);
