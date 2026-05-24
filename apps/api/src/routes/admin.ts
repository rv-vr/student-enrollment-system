import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
// migrated to use D1 via Drizzle
import { drizzle } from "drizzle-orm/d1";
import { enrollments, courses, users } from "../db/schema";
import { eq, and } from "drizzle-orm";

function buildEnrollmentViewRow(row: any, courseRow: any, studentRow: any) {
  return {
    ...row,
    courseCode: courseRow?.code,
    student: studentRow ? { id: studentRow.id, name: studentRow.name } : null,
  };
}
import {
  adminDecisionSchema,
  enrollmentIdParamSchema,
  enrollmentValidationHook,
} from "../validators";

export const adminRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

adminRoutes.use("*", requireAuth);
adminRoutes.use("*", async (c, next) => {
  const user = c.get("user");

  if (user.role !== "admin") {
    return c.json({ success: false, error: "Forbidden", field: "auth" }, 403);
  }

  await next();
});

adminRoutes.get("/requests", async (c) => {
  const db = drizzle(c.env.DB);
  const pending = await db.select().from(enrollments).where(eq(enrollments.status, 'pending')).all();

  const payload = await Promise.all(
    pending.map(async (row) => {
      const courseRow = await db.select().from(courses).where(eq(courses.id, row.courseId)).get();
      const studentRow = await db.select().from(users).where(eq(users.id, row.studentId)).get();
      return buildEnrollmentViewRow(row, courseRow, studentRow);
    }),
  );

  return c.json({ requests: payload });
});

adminRoutes.patch(
  "/requests/:id/decide",
  zValidator("param", enrollmentIdParamSchema, enrollmentValidationHook),
  zValidator("json", adminDecisionSchema, enrollmentValidationHook),
  (c) => async () => {
    const { id } = c.req.valid("param");
    const { action } = c.req.valid("json");

    const db = drizzle(c.env.DB);
    const enrollmentRow = await db.select().from(enrollments).where(eq(enrollments.id, id)).get();

    if (!enrollmentRow) return c.json({ message: "Enrollment request not found" }, 404);

    if (enrollmentRow.status !== 'pending') return c.json({ message: "Enrollment request already decided" }, 409);

    const nextStatus = action === "approve" ? "approved" : "rejected";

    if (nextStatus === 'approved') {
      const courseRow = await db.select().from(courses).where(eq(courses.id, enrollmentRow.courseId)).get();
      if (!courseRow) return c.json({ message: "Course not found" }, 404);

      const approvedCount = await db.select().from(enrollments).where(and(eq(enrollments.courseId, courseRow.id), eq(enrollments.status, 'approved'))).all();
      if ((courseRow.capacity ?? 0) - approvedCount.length <= 0) {
        return c.json({ message: "Course is full. Request cannot be approved." }, 409);
      }
    }

    await db.update(enrollments).set({ status: nextStatus }).where(eq(enrollments.id, id)).run();

    const updated = await db.select().from(enrollments).where(eq(enrollments.id, id)).get();

    const notificationMessage = nextStatus === 'approved' ? `Your enrollment in ${updated.courseId} was approved.` : `Your enrollment in ${updated.courseId} was denied.`;

    // create notification: simple insert into a notifications table not present in schema; fallback to returning message only

    return c.json({
      message: "Enrollment request decision recorded",
      enrollment: buildEnrollmentViewRow(updated, null, null),
      notification: { message: notificationMessage },
    });
  },
);
