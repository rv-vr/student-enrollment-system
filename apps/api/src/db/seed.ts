import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hash } from "bcryptjs";

const databaseName = "uniaces-db";
const args = new Set(process.argv.slice(2));
const useRemote = args.has("--remote");
const dryRun = args.has("--dry-run");

type SeedUser = {
  id: string;
  username: string;
  password: string;
  name: string;
  role: "student" | "instructor" | "admin";
  college: string | null;
  program: string | null;
  campus: string | null;
};

type SeedCourse = {
  id: string;
  title: string;
  description: string | null;
  capacity: number;
  labCredits: number;
  lecCredits: number;
  instructorId: string;
  prerequisites: string[];
};

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function formatNullable(value: string | null) {
  return value === null ? "NULL" : `'${escapeSql(value)}'`;
}

async function buildSeedSql() {
  const admin: SeedUser = {
    id: crypto.randomUUID(),
    username: "2026-0001-R",
    password: "Admin123!",
    name: "Admin One",
    role: "admin",
    college: null,
    program: null,
    campus: "Main Campus",
  };

  const instructor: SeedUser = {
    id: crypto.randomUUID(),
    username: "2026-0002-F",
    password: "Instructor123!",
    name: "Instructor One",
    role: "instructor",
    college: "College of Computing",
    program: "Computer Science",
    campus: "Main Campus",
  };

  const student: SeedUser = {
    id: crypto.randomUUID(),
    username: "2026-0003-A",
    password: "Student123!",
    name: "Student One",
    role: "student",
    college: "College of Computing",
    program: "BS Computer Science",
    campus: "Main Campus",
  };

  const users = [admin, instructor, student];
  const hashedPasswords = await Promise.all(
    users.map((entry) => hash(entry.password, 10)),
  );

  const courses: SeedCourse[] = [
    {
      id: "CS101",
      title: "Introduction to Computer Science",
      description:
        "Foundations of computation, programming, and problem solving.",
      capacity: 30,
      labCredits: 1,
      lecCredits: 2,
      instructorId: instructor.id,
      prerequisites: [],
    },
    {
      id: "CS102",
      title: "Data Structures",
      description: "Lists, stacks, queues, trees, and graphs.",
      capacity: 24,
      labCredits: 1,
      lecCredits: 2,
      instructorId: instructor.id,
      prerequisites: ["CS101"],
    },
    {
      id: "CS201",
      title: "Systems Programming",
      description: "Memory management, concurrency, and low-level tooling.",
      capacity: 18,
      labCredits: 2,
      lecCredits: 2,
      instructorId: instructor.id,
      prerequisites: ["CS101", "CS102"],
    },
  ];

  const statements = [
    "BEGIN TRANSACTION;",
    "DELETE FROM notifications;",
    "DELETE FROM enrollments;",
    "DELETE FROM courses;",
    "DELETE FROM users;",
  ];

  statements.push(
    "INSERT INTO users (id, username, password_hash, name, role, college, program, campus) VALUES",
    users
      .map(
        (entry, index) =>
          `  ('${entry.id}', '${entry.username}', '${escapeSql(hashedPasswords[index])}', '${escapeSql(entry.name)}', '${entry.role}', ${formatNullable(entry.college)}, ${formatNullable(entry.program)}, ${formatNullable(entry.campus)})`,
      )
      .join(",\n"),
    ";",
  );

  statements.push(
    "INSERT INTO courses (id, title, description, capacity, lab_credits, lec_credits, instructor_id, prerequisites) VALUES",
    courses
      .map(
        (course) =>
          `  ('${course.id}', '${escapeSql(course.title)}', ${formatNullable(course.description)}, ${course.capacity}, ${course.labCredits}, ${course.lecCredits}, '${course.instructorId}', '${escapeSql(JSON.stringify(course.prerequisites))}')`,
      )
      .join(",\n"),
    ";",
  );

  statements.push("COMMIT;");

  return statements.join("\n\n");
}

async function run() {
  const seedSql = await buildSeedSql();

  if (dryRun) {
    process.stdout.write(seedSql);
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "uniaces-seed-"));
  const tempFile = join(tempDir, "seed.sql");

  try {
    writeFileSync(tempFile, seedSql, "utf8");

    const executeArgs = [
      "d1",
      "execute",
      databaseName,
      ...(useRemote ? ["--remote"] : ["--local"]),
      "--file",
      tempFile,
    ];

    execFileSync("wrangler", executeArgs, { stdio: "inherit" });
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
      // ignore cleanup errors
    }

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

run();
