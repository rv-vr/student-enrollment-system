import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { coursesRoutes } from "./routes/courses";
import { enrollmentsRoutes } from "./routes/enrollments";
import { sectionsRoutes } from "./routes/sections";
import { usersRoutes } from "./routes/users";
import { studentsRoutes } from "./routes/students";
import { instructorRoutes } from "./routes/instructor";
import { notificationsRoutes } from "./routes/notifications";
import { type AppBindings } from "./auth";

const app = new Hono<{ Bindings: AppBindings }>();

app.use(
  "/*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (c) => {
  return c.json({
    name: "UniACES API",
    routes: [
      "/auth/login",
      "/courses",
      "/courses/:code/availability",
      "/users",
      "/sections",
      "/students/:id/courses",
      "/students/:id/notifications",
      "/instructor/sections",
      "/enrollments/:id/grade",
      "/enrollments",
      "/enroll",
      "/drop",
      "/admin/users",
      "/admin/sections",
      "/admin/courses",
      "/admin/requests",
      "/admin/requests/:id/decide",
    ],
  });
});

app.route("/auth", authRoutes);
app.route("/courses", coursesRoutes);
app.route("/users", usersRoutes);
app.route("/sections", sectionsRoutes);
app.route("/students", studentsRoutes);
app.route("/", enrollmentsRoutes);
app.route("/instructor", instructorRoutes);
app.route("/admin", adminRoutes);
app.route("/notifications", notificationsRoutes);

export const routes = app;
export type AppType = typeof routes;

export default routes;
