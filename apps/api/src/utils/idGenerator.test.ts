import { describe, expect, it } from "vitest";

import { generateAcademicUsername } from "./idGenerator";

describe("generateAcademicUsername", () => {
  it("generates student usernames with an allowed suffix", () => {
    expect(generateAcademicUsername("student")).toMatch(
      /^20\d{2}-\d{4}-[AIH]$/,
    );
  });

  it("generates instructor usernames with the instructor suffix", () => {
    expect(generateAcademicUsername("instructor")).toMatch(/^20\d{2}-\d{4}-F$/);
  });

  it("generates admin usernames with the admin suffix", () => {
    expect(generateAcademicUsername("admin")).toMatch(/^20\d{2}-\d{4}-R$/);
  });
});
