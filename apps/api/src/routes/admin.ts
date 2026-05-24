import { zValidator } from "@hono/zod-validator";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { courses, enrollments, notifications, users } from "../db/schema";
import { generateAcademicUsername } from "../utils/idGenerator";
import {
  adminDecisionSchema,
  enrollmentIdParamSchema,
  enrollmentValidationHook,
} from "../validators";

type CourseRow = typeof courses.$inferSelect;
type EnrollmentRow = typeof enrollments.$inferSelect;
type UserRow = typeof users.$inferSelect;
type PublicUserRow = Omit<UserRow, "passwordHash">;

const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1),
  password: z.string().min(1),
  role: z.enum(["student", "instructor", "admin"]),
  college: z.string().trim().min(1).optional(),
  program: z.string().trim().min(1).optional(),
  campus: z.string().trim().min(1).optional(),
});

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [] as unknown[];

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
) {
  return {
    ...row,
    userId: row.userId,
    studentId: row.userId,
    courseId: row.courseId,
    courseCode: row.courseId,
    course: courseRow
      ? { ...courseRow, prerequisites: parseJsonArray(courseRow.prerequisites) }
      : null,
    student: studentRow
      ? {
          id: studentRow.id,
          username: studentRow.username,
          name: studentRow.name,
        }
      : null,
  };
}

function getOpenSeatCount(rows: EnrollmentRow[]) {
  return rows.filter(
    (row) => row.status === "ongoing" || row.status === "completed",
  ).length;
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

export const adminRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

adminRoutes.use("*", requireAuth);
adminRoutes.use("*", requireAdmin);

adminRoutes.get("/users", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(users).all();

  const payload: PublicUserRow[] = rows.map(({ passwordHash: _passwordHash, ...publicUser }) => publicUser);

  return c.json({ users: payload });
});

adminRoutes.post(
  "/users",
  zValidator("json", adminCreateUserSchema),
  async (c) => {
    const { name, password, role, college, program, campus } = c.req.valid(
      "json",
    );
    const db = drizzle(c.env.DB);

    let username = "";
    let existingUser: UserRow | undefined;

    for (let attempt = 0; attempt < 25; attempt++) {
      username = generateAcademicUsername(role);
      existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (!existingUser) {
        break;
      }
    }

    if (existingUser) {
      return c.json(
        { success: false, error: "Unable to generate a unique username.", field: "username" },
        409,
      );
    }

    const id = crypto.randomUUID();
    const passwordHash = await hash(password, 10);

    await db
      .insert(users)
      .values({
        id,
        username,
        passwordHash,
        name,
        role,
        college: college ?? null,
        program: program ?? null,
        campus: campus ?? null,
      })
      .run();

    const createdUser = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .get();

    if (!createdUser) {
      return c.json(
        { success: false, error: "User creation failed.", field: "user" },
        500,
      );
    }

    const { passwordHash: _passwordHash, ...publicUser } = createdUser;

    return c.json({ user: publicUser }, 201);
  },
);

adminRoutes.get("/requests", async (c) => {
  const db = drizzle(c.env.DB);
  const pending = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.status, "pending"))
    .all();

  const payload = await Promise.all(
    pending.map(async (row: EnrollmentRow) => {
      const courseRow = await db
        .select()
        .from(courses)
        .where(eq(courses.id, row.courseId))
        .get();
      const studentRow = await db
        .select()
        .from(users)
        .where(eq(users.id, row.userId))
        .get();
      return buildEnrollmentViewRow(row, courseRow, studentRow);
    }),
  );

  return c.json({ requests: payload });
});

adminRoutes.patch(
  "/requests/:id/decide",
  zValidator("param", enrollmentIdParamSchema, enrollmentValidationHook),
  zValidator("json", adminDecisionSchema, enrollmentValidationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const { action } = c.req.valid("json");
    const db = drizzle(c.env.DB);

    const enrollmentRow = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .get();
    if (!enrollmentRow)
      return c.json({ message: "Enrollment request not found" }, 404);

    if (enrollmentRow.status !== "pending") {
      return c.json({ message: "Enrollment request already decided" }, 409);
    }

    const nextStatus = action === "approve" ? "ongoing" : "dropped";

    if (nextStatus === "ongoing") {
      const courseRow = await db
        .select()
        .from(courses)
        .where(eq(courses.id, enrollmentRow.courseId))
        .get();
      if (!courseRow) return c.json({ message: "Course not found" }, 404);

      const activeRows = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.courseId, courseRow.id))
        .all();
      if (courseRow.capacity - getOpenSeatCount(activeRows) <= 0) {
        return c.json(
          { message: "Course is full. Request cannot be approved." },
          409,
        );
      }
    }

    const decisionTime = new Date().toISOString();
    const enrolledAt =
      nextStatus === "ongoing" ? decisionTime : enrollmentRow.dateEnrolled;

    await db
      .update(enrollments)
      .set({
        status: nextStatus,
        dateEnrolled: enrolledAt,
        dateRequested: enrollmentRow.dateRequested,
      })
      .where(eq(enrollments.id, id))
      .run();

    const updated = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .get();

    if (!updated) {
      return c.json({ message: "Enrollment request not found" }, 404);
    }

    const courseRow = await db
      .select()
      .from(courses)
      .where(eq(courses.id, updated.courseId))
      .get();
    const studentRow = await db
      .select()
      .from(users)
      .where(eq(users.id, updated.userId))
      .get();

    const title =
      nextStatus === "ongoing" ? "Enrollment approved" : "Enrollment denied";
    const message =
      nextStatus === "ongoing"
        ? `Your enrollment in ${updated.courseId} was approved.`
        : `Your enrollment in ${updated.courseId} was denied.`;

    const notificationId = crypto.randomUUID();

    await db
      .insert(notifications)
      .values({
        id: notificationId,
        userId: updated.userId,
        title,
        message,
        type: nextStatus === "ongoing" ? "success" : "warning",
        isRead: 0,
        createdAt: decisionTime,
      })
      .run();

    const notification = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .get();

    return c.json({
      message: "Enrollment request decision recorded",
      enrollment: buildEnrollmentViewRow(updated, courseRow, studentRow),
      notification,
    });
  },
);
