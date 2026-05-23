import { describe, expect, it } from "vitest";

import { gradeSchema, loginSchema, studentIdParamSchema } from "./validators";
import { authenticateActor } from "./auth";

describe("validators", () => {
  it("accepts modern actor IDs and rejects legacy numeric IDs", () => {
    expect(studentIdParamSchema.safeParse({ id: "2026-1234-A" }).success).toBe(
      true,
    );
    expect(studentIdParamSchema.safeParse({ id: "2026-5678-I" }).success).toBe(
      true,
    );

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

  it("validates login payloads and authenticates by last name", () => {
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

    expect(authenticateActor("2026-1842-A", "Patel")?.role).toBe("student");
    expect(authenticateActor("2026-1338-R", "Chen")?.role).toBe("admin");
    expect(authenticateActor("2026-1842-A", "Wrong")).toBeUndefined();
  });
});
