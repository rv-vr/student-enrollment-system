import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createAuthToken, authenticateActor, type AppBindings } from "../auth";
import { loginSchema, loginValidationHook } from "../validators";

export const authRoutes = new Hono<{ Bindings: AppBindings }>();

authRoutes.post(
  "/login",
  zValidator("json", loginSchema, loginValidationHook),
  async (c) => {
    const { username, password } = c.req.valid("json");
    const user = await authenticateActor(c.env.DB, username, password);

    if (!user) {
      return c.json(
        {
          success: false,
          error:
            "Invalid credentials provided. Please check your ID and password.",
          field: "auth",
        },
        401,
      );
    }

    const secret = c.env.JWT_SECRET;

    if (!secret) {
      return c.json(
        {
          success: false,
          error: "Server misconfiguration: JWT secret missing",
        },
        500,
      );
    }

    const token = await createAuthToken(secret, user);

    return c.json({
      success: true,
      token,
      user,
    });
  },
);
