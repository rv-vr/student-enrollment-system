import { createMiddleware } from "hono/factory";
import { sign, verify } from "hono/jwt";
import { z } from "zod";

import { getHumanActor, getHumanActorRole, getLastName } from "./store";
import { eq } from "drizzle-orm";
import { users } from "./db/schema";
import { getDbFromBindings } from "./db";
import { timingSafeEqual } from "crypto";

export type AuthRole = "student" | "instructor" | "admin";

export type AuthUser = {
  id: string;
  role: AuthRole;
  name: string;
};

export type AppVariables = {
  user: AuthUser;
};

export type AppBindings = {
  JWT_SECRET: string;
  DB: D1Database;
};

const authUserSchema = z
  .object({
    id: z.string(),
    role: z.enum(["student", "instructor", "admin"]),
    name: z.string(),
  })
  .passthrough();

export async function createAuthToken(secret: string, user: AuthUser) {
  if (!secret || typeof secret !== "string" || secret.trim() === "") {
    throw new Error("Server misconfiguration: JWT secret is not set");
  }

  return sign(
    {
      ...user,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    },
    secret,
  );
}

export async function authenticateActor(dbBinding: D1Database, username: string, password: string) {
  const db = getDbFromBindings({ DB: dbBinding });

  const actor = await db.select().from(users).where(eq(users.username, username)).get();

  if (!actor) return undefined;

  const storedHash = (actor as any).password_hash ?? (actor as any).passwordHash ?? "";
  const provided = password.trim();

  // timingSafeEqual expects Buffers of same length — perform a safe comparison
  const a = Buffer.from(String(storedHash));
  const b = Buffer.from(String(provided));

  if (a.length !== b.length) {
    // still run a timing-safe comparison against a dummy buffer to avoid timing leaks
    timingSafeEqual(a, Buffer.from(a));
    return undefined;
  }

  if (!timingSafeEqual(a, b)) return undefined;

  const role = getHumanActorRole(actor.id) ?? (actor.role as AuthRole);

  if (!role) return undefined;

  return {
    id: actor.id,
    role,
    name: actor.name,
  } satisfies AuthUser;
}

export const requireAuth = createMiddleware<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return c.json(
      { success: false, error: "Unauthorized", field: "auth" },
      401,
    );
  }

  const secret = c.env.JWT_SECRET;

  if (!secret) {
    // Fail closed if secret missing — server misconfiguration
    return c.json(
      { success: false, error: "Server misconfiguration: JWT secret missing" },
      500,
    );
  }

  try {
    // Enforce expected algorithm explicitly (HS256) during verification
    const decoded = await verify(match[1], secret, "HS256");
    const parsed = authUserSchema.safeParse(decoded);

    if (!parsed.success) {
      return c.json(
        { success: false, error: "Unauthorized", field: "auth" },
        401,
      );
    }

    c.set("user", parsed.data);
    await next();
  } catch {
    return c.json(
      { success: false, error: "Unauthorized", field: "auth" },
      401,
    );
  }
});
