// apps/api/src/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. USERS TABLE (Students, Instructors, Admins)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // We'll use UUIDs or short IDs
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').$type<'student' | 'instructor' | 'admin'>().notNull(),
});

// 2. COURSES TABLE
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // e.g., "CS-101"
  title: text('title').notNull(),
  description: text('description'),
  instructorId: text('instructor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  capacity: integer('capacity').notNull().default(30),
});

// 3. ENROLLMENTS TABLE (The Approval & Grading Ledger)
export const enrollments = sqliteTable('enrollments', {
  id: text('id').primaryKey(),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  status: text('status').$type<'pending' | 'approved' | 'rejected'>().notNull().default('pending'),
  grade: real('grade'), // Nullable until an instructor submits a grade
});