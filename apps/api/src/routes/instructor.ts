import { Hono } from "hono";
import { requireAuth, type AppBindings, type AppVariables } from "../auth";
// migration: use DB queries instead of in-memory store
import { drizzle } from "drizzle-orm/d1";
import { courses as coursesTable, enrollments, users } from "../db/schema";
import { eq } from "drizzle-orm";

function buildEnrollmentViewRowMinimal(row: any) {
  return {
    id: row.id,
    studentId: row.student_id,
    courseCode: row.course_code,
    status: row.status,
    grade: row.grade,
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
  const assignedCourses = await db.select().from(coursesTable).where(eq(coursesTable.instructor_id, user.id)).all();

  const payload = await Promise.all(
    assignedCourses.map(async (course) => {
      const roster = await db.select().from(enrollments).where(eq(enrollments.course_id, course.id)).all();

      return {
        course,
        roster: roster.map((r) => buildEnrollmentViewRowMinimal(r)),
      };
    }),
  );

  return c.json({ classes: payload });
});
