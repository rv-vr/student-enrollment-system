import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { courseCodeParamSchema, courseValidationHook } from "../validators";
import {
  courses,
  getActiveEnrollmentCount,
  getCourse,
  getRemainingSeats,
} from "../store";

export const coursesRoutes = new Hono();

coursesRoutes.get("/", (c) => {
  return c.json(
    courses.map((course) => ({
      ...course,
      enrolledCount: getActiveEnrollmentCount(course.code),
      remainingSeats: getRemainingSeats(course.code),
    })),
  );
});

coursesRoutes.get(
  "/:code/availability",
  zValidator("param", courseCodeParamSchema, courseValidationHook),
  (c) => {
    const { code } = c.req.valid("param");
    const course = getCourse(code);

    if (!course) {
      return c.json({ message: "Course not found" }, 404);
    }

    const remainingSeats = getRemainingSeats(course.code);

    return c.json({
      course,
      enrolledCount: getActiveEnrollmentCount(course.code),
      remainingSeats,
      hasCapacity: remainingSeats > 0,
    });
  },
);
