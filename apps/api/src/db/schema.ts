import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type UserRole = "student" | "instructor" | "admin";
export type EnrollmentStatus =
  | "completed"
  | "inc"
  | "dropped"
  | "pending"
  | "ongoing"
  | "finalized";
export type NotificationType = "info" | "success" | "warning" | "alert";
export type SectionScheduleEntry = {
  day: string;
  time: string;
  type: string;
};

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

export const sections = sqliteTable("sections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sectionName: text("section_name").notNull(),
  capacity: integer("capacity").notNull(),
  scheduleArray: text("schedule_array", { mode: "json" })
    .$type<SectionScheduleEntry[]>()
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
  sectionId: text("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
