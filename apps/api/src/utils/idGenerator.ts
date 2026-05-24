const ACADEMIC_YEAR = "2026" as const;
const STUDENT_SUFFIXES = ["A", "I", "H"] as const;

export type AcademicRole = "student" | "instructor" | "admin";

function randomDigit() {
  const value = new Uint8Array(1);
  crypto.getRandomValues(value);
  return value[0] % 10;
}

function randomStudentSuffix() {
  const value = new Uint8Array(1);
  crypto.getRandomValues(value);
  return STUDENT_SUFFIXES[value[0] % STUDENT_SUFFIXES.length];
}

function generateDigitBlock() {
  return Array.from({ length: 4 }, () => randomDigit()).join("");
}

export function generateAcademicUsername(role: AcademicRole): string {
  const suffix =
    role === "instructor"
      ? "F"
      : role === "admin"
        ? "R"
        : randomStudentSuffix();

  return `${ACADEMIC_YEAR}-${generateDigitBlock()}-${suffix}`;
}