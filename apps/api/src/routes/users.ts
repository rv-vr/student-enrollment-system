import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { users } from "../db/schema";

type UserRow = typeof users.$inferSelect;
type PublicUserRow = Omit<UserRow, "passwordHash">;

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

const userQuerySchema = z.object({
  role: z.enum(["student", "instructor", "admin"]).optional(),
});

function toPublicUserRow(row: UserRow): PublicUserRow {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    college: row.college,
    program: row.program,
    campus: row.campus,
  };
}

export const usersRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

usersRoutes.use("*", requireAuth);
usersRoutes.use("*", requireAdmin);

usersRoutes.get("/", zValidator("query", userQuerySchema), async (c) => {
  const { role } = c.req.valid("query");
  const db = drizzle(c.env.DB);

  const rows = role
    ? await db.select().from(users).where(eq(users.role, role)).all()
    : await db.select().from(users).all();

  return c.json({ users: rows.map((row) => toPublicUserRow(row)) });
});
