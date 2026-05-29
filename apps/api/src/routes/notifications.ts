import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, type AppBindings, type AppVariables } from "../auth";
import { notifications } from "../db/schema";

export const notificationsRoutes = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

notificationsRoutes.use("*", requireAuth);

notificationsRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = drizzle(c.env.DB);

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .all();

  return c.json({
    notifications: rows.map((row) => ({
      ...row,
      isRead: Boolean(row.isRead),
    })),
  });
});

notificationsRoutes.patch(
  "/:id/read",
  zValidator(
    "param",
    z.object({
      id: z.string().uuid(),
    }),
  ),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const db = drizzle(c.env.DB);

    const row = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .get();

    if (!row) {
      return c.json({ success: false, error: "Notification not found" }, 404);
    }

    if (row.userId !== user.id) {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    await db
      .update(notifications)
      .set({ isRead: 1 })
      .where(eq(notifications.id, id))
      .run();

    return c.json({ success: true, message: "Notification marked as read" });
  },
);
