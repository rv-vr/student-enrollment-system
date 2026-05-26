import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashSync } from "bcryptjs";

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

type SeedSection = {
  id: string;
  courseId: string;
  instructorId: string;
  sectionName: string;
  capacity: number;
  scheduleArray: { day: string; time: string; type: string }[];
};

type SeedEnrollment = {
  id: string;
  courseId: string;
  sectionId: string;
  userId: string;
  status: "pending" | "ongoing";
  dateRequested: string;
  dateEnrolled: string | null;
  grade: number | null;
  remark: string | null;
};

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function formatNullable(value: string | null) {
  return value === null ? "NULL" : `'${escapeSql(value)}'`;
}

async function buildSeedSql() {
  const users: SeedUser[] = [
    {
      id: crypto.randomUUID(),
      username: "2026-0001-R",
      password: "Admin123!",
      name: "Admin One",
      role: "admin",
      college: null,
      program: null,
      campus: "Main Campus",
    },
    {
      id: crypto.randomUUID(),
      username: "2026-0002-F",
      password: "Instructor123!",
      name: "Instructor One",
      role: "instructor",
      college: "College of Computing",
      program: "Computer Science",
      campus: "Main Campus",
    },
    {
      id: crypto.randomUUID(),
      username: "2026-0004-F",
      password: "Instructor456!",
      name: "Instructor Two",
      role: "instructor",
      college: "College of Computing",
      program: "Information Technology",
      campus: "Main Campus",
    },
    {
      id: crypto.randomUUID(),
      username: "2026-0003-A",
      password: "Student123!",
      name: "Student One",
      role: "student",
      college: "College of Computing",
      program: "BS Computer Science",
      campus: "Main Campus",
    },
    {
      id: crypto.randomUUID(),
      username: "2026-0005-I",
      password: "Student456!",
      name: "Student Two",
      role: "student",
      college: "College of Computing",
      program: "BS Information Technology",
      campus: "Main Campus",
    },
  ];

  const hashedUsers = users.map((entry) => ({
    ...entry,
    passwordHash: hashSync(entry.password, 10),
  }));

  const courses: SeedCourse[] = [
    {
      id: "CS101",
      title: "Introduction to Computer Science",
      description:
        "Foundations of computation, programming, and problem solving.",
      capacity: 30,
      labCredits: 1,
      lecCredits: 2,
      instructorId: users[1].id,
      prerequisites: [],
    },
    {
      id: "CS102",
      title: "Data Structures",
      description: "Lists, stacks, queues, trees, and graphs.",
      capacity: 24,
      labCredits: 1,
      lecCredits: 2,
      instructorId: users[1].id,
      prerequisites: ["CS101"],
    },
    {
      id: "CS201",
      title: "Systems Programming",
      description: "Memory management, concurrency, and low-level tooling.",
      capacity: 18,
      labCredits: 2,
      lecCredits: 2,
      instructorId: users[2].id,
      prerequisites: ["CS101", "CS102"],
    },
  ];

  const sections: SeedSection[] = [
    {
      id: crypto.randomUUID(),
      courseId: courses[0].id,
      instructorId: users[1].id,
      sectionName: "Section A",
      capacity: 30,
      scheduleArray: [
        { day: "Monday", time: "08:00 - 09:30", type: "Lecture" },
        { day: "Wednesday", time: "08:00 - 10:00", type: "Lab" },
      ],
    },
    {
      id: crypto.randomUUID(),
      courseId: courses[1].id,
      instructorId: users[2].id,
      sectionName: "BSCS-2A",
      capacity: 24,
      scheduleArray: [
        { day: "Tuesday", time: "10:00 - 11:30", type: "Lecture" },
        { day: "Thursday", time: "10:00 - 12:00", type: "Lab" },
      ],
    },
    {
      id: crypto.randomUUID(),
      courseId: courses[2].id,
      instructorId: users[2].id,
      sectionName: "Section B",
      capacity: 18,
      scheduleArray: [
        { day: "Friday", time: "13:00 - 15:00", type: "Lecture" },
      ],
    },
  ];

  const enrollments: SeedEnrollment[] = [
    {
      id: crypto.randomUUID(),
      courseId: courses[0].id,
      sectionId: sections[0].id,
      userId: users[3].id,
      status: "ongoing",
      dateRequested: new Date().toISOString(),
      dateEnrolled: new Date().toISOString(),
      grade: null,
      remark: null,
    },
    {
      id: crypto.randomUUID(),
      courseId: courses[1].id,
      sectionId: sections[1].id,
      userId: users[4].id,
      status: "pending",
      dateRequested: new Date().toISOString(),
      dateEnrolled: null,
      grade: null,
      remark: null,
    },
  ];

  const statements = [
    "BEGIN TRANSACTION;",
    "DELETE FROM notifications;",
    "DELETE FROM enrollments;",
    "DELETE FROM sections;",
    "DELETE FROM courses;",
    "DELETE FROM users;",
  ];

  statements.push(
    "INSERT INTO users (id, username, password_hash, name, role, college, program, campus) VALUES",
    hashedUsers
      .map(
        (entry) =>
          `  ('${entry.id}', '${entry.username}', '${escapeSql(entry.passwordHash)}', '${escapeSql(entry.name)}', '${entry.role}', ${formatNullable(entry.college)}, ${formatNullable(entry.program)}, ${formatNullable(entry.campus)})`,
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

  statements.push(
    "INSERT INTO sections (id, course_id, instructor_id, section_name, capacity, schedule_array) VALUES",
    sections
      .map(
        (section) =>
          `  ('${section.id}', '${section.courseId}', '${section.instructorId}', '${escapeSql(section.sectionName)}', ${section.capacity}, '${escapeSql(JSON.stringify(section.scheduleArray))}')`,
      )
      .join(",\n"),
    ";",
  );

  statements.push(
    "INSERT INTO enrollments (id, status, course_id, section_id, user_id, date_enrolled, date_requested, grade, remark) VALUES",
    enrollments
      .map(
        (enrollment) =>
          `  ('${enrollment.id}', '${enrollment.status}', '${enrollment.courseId}', '${enrollment.sectionId}', '${enrollment.userId}', ${formatNullable(enrollment.dateEnrolled)}, '${enrollment.dateRequested}', ${enrollment.grade === null ? "NULL" : enrollment.grade}, ${formatNullable(enrollment.remark)})`,
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
