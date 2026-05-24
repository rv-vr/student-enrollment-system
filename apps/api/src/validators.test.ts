import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";
import { describe, expect, it } from "vitest";

import { gradeSchema, loginSchema, studentIdParamSchema } from "./validators";
import { authenticateActor } from "./auth";

function createD1Mock() {
  const sqlite = new Database(":memory:");

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      college TEXT,
      program TEXT,
      campus TEXT
    );
  `);

  return {
    sqlite,
    db: {
      prepare(sql: string) {
        const statement = sqlite.prepare(sql);

        return {
          bind(...params: unknown[]) {
            const bound = statement.bind(...params);

            return {
              all: async () => ({ results: bound.all() }),
              run: async () => bound.run(),
              raw: (rawMode = true) => bound.raw(rawMode).all(),
            };
          },
        };
      },
    },
  };
}

describe("validators", () => {
  it("accepts UUID student IDs and rejects actor-style identifiers", () => {
    expect(
      studentIdParamSchema.safeParse({ id: "61b1b5d5-5b4f-4b68-8f0d-6bf3f3cc3d81" }).success,
    ).toBe(true);

    expect(studentIdParamSchema.safeParse({ id: "1234" }).success).toBe(false);
    expect(studentIdParamSchema.safeParse({ id: "2026-12-A" }).success).toBe(
      false,
    );
    expect(studentIdParamSchema.safeParse({ id: "2026-1234-R" }).success).toBe(
      false,
    );
  });

  it("validates the grade range", () => {
    expect(
      gradeSchema.safeParse({
        enrollmentId: "61b1b5d5-5b4f-4b68-8f0d-6bf3f3cc3d81",
        grade: 1,
      }).success,
    ).toBe(true);
    expect(
      gradeSchema.safeParse({
        enrollmentId: "61b1b5d5-5b4f-4b68-8f0d-6bf3f3cc3d81",
        grade: 3.5,
      }).success,
    ).toBe(true);
    expect(
      gradeSchema.safeParse({
        enrollmentId: "61b1b5d5-5b4f-4b68-8f0d-6bf3f3cc3d81",
        grade: 5,
      }).success,
    ).toBe(true);

    expect(
      gradeSchema.safeParse({
        enrollmentId: "61b1b5d5-5b4f-4b68-8f0d-6bf3f3cc3d81",
        grade: 0.99,
      }).success,
    ).toBe(false);
    expect(
      gradeSchema.safeParse({
        enrollmentId: "61b1b5d5-5b4f-4b68-8f0d-6bf3f3cc3d81",
        grade: 5.1,
      }).success,
    ).toBe(false);
  });

  it("validates login payloads and authenticates seeded users with bcrypt", async () => {
    expect(
      loginSchema.safeParse({ username: "2026-1842-A", password: "Patel" })
        .success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ username: "2026-1338-R", password: "Chen" })
        .success,
    ).toBe(true);

    expect(
      loginSchema.safeParse({ username: "1842", password: "Patel" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ username: "2026-1842-A", password: "" }).success,
    ).toBe(false);

    const { db, sqlite } = createD1Mock();

    try {
      const studentPasswordHash = hashSync("Patel", 10);
      const adminPasswordHash = hashSync("Chen", 10);

      sqlite.prepare(
        `INSERT INTO users (id, username, password_hash, name, role, college, program, campus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "61b1b5d5-5b4f-4b68-8f0d-6bf3f3cc3d81",
        "2026-1842-A",
        studentPasswordHash,
        "Student One",
        "student",
        "College of Computing",
        "BS Computer Science",
        "Main Campus",
      );

      sqlite.prepare(
        `INSERT INTO users (id, username, password_hash, name, role, college, program, campus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "8c6f0f9a-2d4a-4f7b-a7a7-2d2a8d5f06fb",
        "2026-1338-R",
        adminPasswordHash,
        "Admin One",
        "admin",
        null,
        null,
        "Main Campus",
      );

      await expect(
        authenticateActor(db as never, "2026-1842-A", "Patel"),
      ).resolves.toMatchObject({ role: "student", name: "Student One" });

      await expect(
        authenticateActor(db as never, "2026-1338-R", "Chen"),
      ).resolves.toMatchObject({ role: "admin", name: "Admin One" });

      await expect(authenticateActor(db as never, "2026-1842-A", "Wrong")).resolves.toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
