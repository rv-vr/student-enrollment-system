import { z } from "zod";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodIssue } from "zod";

import { gradeScaleMax, gradeScaleMin } from "./store";

export const studentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const courseCodeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
});

export const courseCreateSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toUpperCase()),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  capacity: z.number().int().nonnegative(),
  labCredits: z.number().nonnegative(),
  lecCredits: z.number().nonnegative(),
  prerequisites: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .transform((value) => value.toUpperCase()),
    )
    .optional()
    .default([]),
});

export const sectionScheduleItemSchema = z.object({
  day: z.string().trim().min(1),
  time: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

export const sectionCreateSchema = z.object({
  courseCode: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  instructorId: z.string().uuid(),
  sectionName: z.string().trim().min(1),
  capacity: z.number().int().positive(),
  scheduleArray: z.array(sectionScheduleItemSchema).default([]),
});

export const sectionEnrollSchema = z.object({
  sectionId: z.string().uuid(),
});

export const enrollSchema = z.object({
  studentId: z.string().uuid(),
  courseCode: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
});

export const dropSchema = z.object({
  studentId: z.string().uuid(),
  courseCode: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
});

export const gradeSchema = z.object({
  enrollmentId: z.string().uuid(),
  grade: z.union([z.number().min(gradeScaleMin).max(gradeScaleMax), z.null()]),
});

export const instructorGradeUpdateSchema = z.object({
  grade: z.union([z.string().trim().min(1), z.number(), z.null()]).optional(),
  remark: z.union([z.string().trim().min(1), z.null()]).optional(),
});

export const enrollmentStatusSchema = z.enum([
  "completed",
  "inc",
  "dropped",
  "pending",
  "ongoing",
  "finalized",
]);

export const enrollmentRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  courseCode: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  status: enrollmentStatusSchema,
  sectionId: z.string().uuid(),
  grade: z.union([z.number().min(gradeScaleMin).max(gradeScaleMax), z.null()]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const notificationReadStatusSchema = z.enum(["unread", "read"]);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  message: z.string().trim().min(1),
  timestamp: z.string().datetime(),
  readStatus: notificationReadStatusSchema,
});

export const adminDecisionSchema = z.object({
  action: z.enum(["approve", "deny"]),
});

export const enrollmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^2026-\d{4}-(?:A|I|H|F|R)$/),
  password: z.string().trim().min(1),
});

type ValidationFailureResult = {
  success: false;
  error: {
    issues: ZodIssue[];
  };
};

type ValidationHookOptions = {
  fieldAliases?: Record<string, string>;
  fieldMessages?: Record<string, string>;
  tokenFieldMessages?: Record<string, string>;
  statusCode?: number;
  fieldName?: string;
  errorMessage?: string;
};

function isValidationFailure(
  result: unknown,
): result is ValidationFailureResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "success" in result &&
    (result as { success?: unknown }).success === false &&
    "error" in result &&
    typeof (result as { error?: unknown }).error === "object" &&
    (result as { error?: { issues?: unknown } }).error !== null &&
    Array.isArray((result as { error?: { issues?: unknown } }).error?.issues)
  );
}

function getValidationField(
  issue: ZodIssue,
  fieldAliases: Record<string, string>,
) {
  const rawField = String(issue.path[0] ?? "input");

  return fieldAliases[rawField] ?? rawField;
}

function formatValidationError(
  field: string,
  issue: ZodIssue,
  options: ValidationHookOptions,
) {
  const aliasedMessage = options.fieldMessages?.[field];

  if (aliasedMessage) {
    return aliasedMessage;
  }

  const tokenMessage = options.tokenFieldMessages?.[field];

  if (tokenMessage) {
    return tokenMessage;
  }

  switch (issue.code) {
    case "invalid_type":
      return `Invalid ${field}. Expected ${issue.expected}.`;
    case "invalid_format":
      return `Invalid ${field} format.`;
    case "too_small":
      if (issue.origin === "string" && issue.minimum === 1) {
        return `Invalid ${field}. Must not be empty.`;
      }

      return `Invalid ${field}. Must be at least ${issue.minimum}.`;
    case "too_big":
      return `Invalid ${field}. Must be at most ${issue.maximum}.`;
    case "unrecognized_keys":
      return `Invalid input. Unrecognized key ${issue.keys[0]}.`;
    case "custom":
      return issue.message
        ? `Invalid ${field}. ${issue.message}`
        : `Invalid ${field}.`;
    default:
      return issue.message
        ? `Invalid ${field}. ${issue.message}`
        : `Invalid ${field}.`;
  }
}

export function createValidationErrorHook(options: ValidationHookOptions = {}) {
  return (result: unknown, c: Context) => {
    if (!isValidationFailure(result)) {
      return;
    }

    const issue = result.error.issues[0];
    const statusCode = (options.statusCode ?? 400) as ContentfulStatusCode;

    if (!issue) {
      return c.json(
        {
          success: false,
          error: options.errorMessage ?? "Invalid input.",
          field: options.fieldName ?? "input",
        },
        statusCode,
      );
    }

    const field =
      options.fieldName ??
      getValidationField(issue, options.fieldAliases ?? {});

    return c.json(
      {
        success: false,
        error:
          options.errorMessage ?? formatValidationError(field, issue, options),
        field,
      },
      statusCode,
    );
  };
}

const enrollmentTokenMessage = "Invalid enrollment ID format. Expected a UUID.";
const loginFailureMessage =
  "Invalid credentials provided. Please check your username and password.";

export const studentValidationHook = createValidationErrorHook({
  fieldAliases: { id: "studentId" },
  tokenFieldMessages: { studentId: "Invalid student ID. Expected a UUID." },
});

export const courseValidationHook = createValidationErrorHook({
  fieldAliases: { code: "courseCode", id: "courseCode" },
});

export const sectionValidationHook = createValidationErrorHook({
  fieldAliases: {
    courseCode: "courseCode",
    instructorId: "instructorId",
    sectionName: "sectionName",
  },
});

export const enrollmentValidationHook = createValidationErrorHook({
  tokenFieldMessages: {
    studentId: "Invalid student ID. Expected a UUID.",
    enrollmentId: enrollmentTokenMessage,
  },
});

export const loginValidationHook = createValidationErrorHook({
  statusCode: 401,
  fieldName: "auth",
  errorMessage: loginFailureMessage,
});
