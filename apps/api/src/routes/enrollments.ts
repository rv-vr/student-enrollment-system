import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import {
  courses,
  enrollments,
  sections,
  users,
  type SectionScheduleEntry,
} from "../db/schema";
import {
  dropSchema,
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

function normalizeCourseCodeList(value: unknown) {
  return parseJsonArray(value)
    .map((entry) => String(entry).trim().toUpperCase())
    .filter((entry) => entry.length > 0);
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
      (
        slot,
      ): slot is SectionScheduleEntry =>
        slot !== null && Boolean(slot.day && slot.time),
    );
}

function parseClockTime(value: string) {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (!meridiem) {
    if (hour < 0 || hour > 23) {
      return null;
    }

    return hour * 60 + minute;
  }

  if (hour < 1 || hour > 12) {
    return null;
  }

  let normalizedHour = hour % 12;

  if (meridiem === "PM") {
    normalizedHour += 12;
  }

  return normalizedHour * 60 + minute;
}

function parseTimeRange(value: string) {
  const [startValue, endValue] = value.split(/\s*-\s*/);

  if (!startValue || !endValue) {
    return null;
  }

  const start = parseClockTime(startValue);
  const end = parseClockTime(endValue);

  if (start === null || end === null || start >= end) {
    return null;
  }

  return { start, end };
}

function schedulesOverlap(
  leftSlot: SectionScheduleEntry,
  rightSlot: SectionScheduleEntry,
) {
  if (leftSlot.day.trim().toLowerCase() !== rightSlot.day.trim().toLowerCase()) {
    return false;
  }

  const leftRange = parseTimeRange(leftSlot.time);
  const rightRange = parseTimeRange(rightSlot.time);

  if (!leftRange || !rightRange) {
    return false;
  }

  return leftRange.start < rightRange.end && rightRange.start < leftRange.end;
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

    const targetSectionCourseRow = await db
      .select({ prerequisites: courses.prerequisites })
      .from(sections)
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .where(eq(sections.id, sectionId))
      .get();

    const requiredPrerequisites = normalizeCourseCodeList(
      targetSectionCourseRow?.prerequisites,
    );

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

    const targetScheduleSlots = normalizeScheduleSlots(sectionRow.scheduleArray);

    if (targetScheduleSlots.length > 0) {
      const activeScheduleRows = await db
        .select({ scheduleArray: sections.scheduleArray })
        .from(enrollments)
        .innerJoin(sections, eq(enrollments.sectionId, sections.id))
        .where(
          and(
            eq(enrollments.userId, user.id),
            eq(enrollments.status, "ongoing"),
          ),
        )
        .all();

      const activeScheduleSlots = activeScheduleRows.flatMap((row) =>
        normalizeScheduleSlots(row.scheduleArray),
      );

      for (const targetSlot of targetScheduleSlots) {
        const conflictingSlot = activeScheduleSlots.find((activeSlot) =>
          schedulesOverlap(targetSlot, activeSlot),
        );

        if (conflictingSlot) {
          return c.json(
            {
              message: `Schedule conflict! This section conflicts with your current class schedule on ${targetSlot.day} during ${targetSlot.time}.`,
            },
            400,
          );
        }
      }
    }

    if (requiredPrerequisites.length > 0) {
      const completedHistory = await db
        .select({ courseCode: courses.id })
        .from(enrollments)
        .innerJoin(sections, eq(enrollments.sectionId, sections.id))
        .innerJoin(courses, eq(sections.courseId, courses.id))
        .where(
          and(
            eq(enrollments.userId, user.id),
            eq(enrollments.status, "completed"),
          ),
        )
        .all();

      const completedCourseCodes = new Set(
        completedHistory.map((row) => row.courseCode.toUpperCase()),
      );
      const missingPrerequisites = requiredPrerequisites.filter(
        (courseCode) => !completedCourseCodes.has(courseCode),
      );

      if (missingPrerequisites.length > 0) {
        return c.json(
          {
            message: `Cannot enroll. You are missing the following prerequisites: [${missingPrerequisites.join(
              ", ",
            )}]`,
          },
          400,
        );
      }
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
