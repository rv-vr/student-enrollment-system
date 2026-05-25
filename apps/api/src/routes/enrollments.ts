import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, sections, users } from "../db/schema";
import {
  dropSchema,
  enrollSchema,
  enrollmentValidationHook,
  instructorGradeUpdateSchema,
  sectionEnrollSchema,
} from "../validators";

type EnrollmentRow = typeof enrollments.$inferSelect;
type CourseRow = typeof courses.$inferSelect;
type SectionRow = typeof sections.$inferSelect;
type UserRow = typeof users.$inferSelect;

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [] as unknown[];
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as unknown[];
  }
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

  if (Number.isFinite(numericValue)) {
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

function buildEnrollmentViewRow(
  row: EnrollmentRow,
  courseRow?: CourseRow,
  sectionRow?: SectionRow,
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

async function getSectionSnapshot(db: ReturnType<typeof drizzle>, courseId: string) {
  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.courseId, courseId))
    .all();

  const enrollmentRows = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .all();

  const activeCounts = new Map<string, number>();

  for (const row of enrollmentRows) {
    if (row.status !== "ongoing" && row.status !== "completed") {
      continue;
    }

    activeCounts.set(row.sectionId, (activeCounts.get(row.sectionId) ?? 0) + 1);
  }

  const sectionSummaries = sectionRows.map((sectionRow) => ({
    sectionRow,
    enrolledCount: activeCounts.get(sectionRow.id) ?? 0,
    remainingSeats: Math.max(
      sectionRow.capacity - (activeCounts.get(sectionRow.id) ?? 0),
      0,
    ),
  }));

  const selectedSection = sectionSummaries.find(
    (entry) => entry.remainingSeats > 0,
  );

  return {
    sectionSummaries,
    selectedSection,
    totalCapacity: sectionSummaries.reduce(
      (sum, entry) => sum + entry.sectionRow.capacity,
      0,
    ),
    totalRemainingSeats: sectionSummaries.reduce(
      (sum, entry) => sum + entry.remainingSeats,
      0,
    ),
  };
}

export const enrollmentsRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

enrollmentsRoutes.use("*", requireAuth);

enrollmentsRoutes.post(
  "/enrollments",
  zValidator("json", sectionEnrollSchema, enrollmentValidationHook),
  async (c) => {
    const user = c.get("user");

    if (user.role !== "student") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const { sectionId } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    const sectionRow = await db
      .select()
      .from(sections)
      .where(eq(sections.id, sectionId))
      .get();

    if (!sectionRow) {
      return c.json({ message: "Section not found" }, 404);
    }

    const existingEnrollment = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, user.id),
          eq(enrollments.sectionId, sectionId),
        ),
      )
      .get();

    if (existingEnrollment) {
      return c.json({ message: "Already enrolled in this section" }, 400);
    }

    const activeEnrollments = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.sectionId, sectionId))
      .all();

    const activeSeatCount = activeEnrollments.filter(
      (row) => row.status === "ongoing" || row.status === "completed",
    ).length;

    if (activeSeatCount >= sectionRow.capacity) {
      return c.json({ message: "This section is full" }, 400);
    }

    const enrollmentId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await db
      .insert(enrollments)
      .values({
        id: enrollmentId,
        status: "ongoing",
        courseId: sectionRow.courseId,
        sectionId: sectionRow.id,
        userId: user.id,
        dateEnrolled: timestamp,
        dateRequested: timestamp,
        grade: null,
        remark: null,
      })
      .run();

    const createdEnrollment = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .get();

    if (!createdEnrollment) {
      return c.json({ message: "Enrollment not found" }, 404);
    }

    const courseRow = await db
      .select()
      .from(courses)
      .where(eq(courses.id, sectionRow.courseId))
      .get();

    const studentRow = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .get();

    const instructorRow = await db
      .select()
      .from(users)
      .where(eq(users.id, sectionRow.instructorId))
      .get();

    return c.json(
      {
        message: "Enrollment created",
        enrollment: buildEnrollmentViewRow(
          createdEnrollment,
          courseRow ?? undefined,
          sectionRow,
          studentRow ?? undefined,
          instructorRow ?? undefined,
        ),
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

    const sectionRow = await db
      .select()
      .from(sections)
      .where(eq(sections.id, enrollmentRow.sectionId))
      .get();

    await db.delete(enrollments).where(eq(enrollments.id, enrollmentRow.id)).run();
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
        sectionRow ?? undefined,
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
  "/enrollments/:id/grade",
  zValidator("json", instructorGradeUpdateSchema, enrollmentValidationHook),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.param();
    const { grade, remark } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    if (user.role !== "instructor") {
      return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
    }

    const enrollmentRow = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .get();

    if (!enrollmentRow) {
      return c.json({ message: "Enrollment not found" }, 404);
    }

    const sectionRow = await db
      .select()
      .from(sections)
      .where(eq(sections.id, enrollmentRow.sectionId))
      .get();

    if (!sectionRow) {
      return c.json({ message: "Section not found" }, 404);
    }

    if (sectionRow.instructorId !== user.id) {
      return c.json({ success: false, error: "Access Denied", field: "auth" }, 403);
    }

    const courseRow = await db
      .select()
      .from(courses)
      .where(eq(courses.id, enrollmentRow.courseId))
      .get();

    const studentRow = await db
      .select()
      .from(users)
      .where(eq(users.id, enrollmentRow.userId))
      .get();

    const updatedGrade = normalizeGradeInput(grade);
    const nextRemark = remark === undefined ? enrollmentRow.remark : remark;

    await db
      .update(enrollments)
      .set({
        grade: updatedGrade,
        remark: nextRemark,
        status: "completed",
      })
      .where(eq(enrollments.id, id))
      .run();

    const updated = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .get();

    if (!updated) {
      return c.json({ message: "Enrollment not found" }, 404);
    }

    return c.json({
      enrollment: buildEnrollmentViewRow(
        updated,
        courseRow ?? undefined,
        sectionRow,
        studentRow ?? undefined,
        undefined,
      ),
    });
  },
);
