import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type UserRole = "student" | "instructor" | "admin";
export type EnrollmentStatus =
  | "completed"
  | "inc"
  | "dropped"
  | "pending"
  | "ongoing";
export type NotificationType = "info" | "success" | "warning" | "alert";

const jsonText = text;

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").$type<UserRole>().notNull(),
  college: text("college"),
  program: text("program"),
  campus: text("campus"),
});

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  capacity: integer("capacity").notNull(),
  labCredits: real("lab_credits").notNull(),
  lecCredits: real("lec_credits").notNull(),
  instructorId: text("instructor_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  prerequisites: text("prerequisites", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
});

export const enrollments = sqliteTable("enrollments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  status: text("status").$type<EnrollmentStatus>().notNull(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  scheduleArray: jsonText("schedule_array").notNull(),
  dateEnrolled: text("date_enrolled"),
  dateRequested: text("date_requested").notNull(),
  grade: real("grade"),
  remark: text("remark"),
});

export const notifications = sqliteTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").$type<NotificationType>().notNull(),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
