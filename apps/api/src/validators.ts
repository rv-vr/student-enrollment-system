import { z } from 'zod'
import type { Context } from 'hono'
import type { ZodIssue } from 'zod'

import { gradeScaleMax, gradeScaleMin } from './store'

const actorIdSchema = (suffixes: readonly ('A' | 'I' | 'R' | 'F')[]) =>
  z.string().regex(new RegExp(`^2026-\\d{4}-(?:${suffixes.join('|')})$`))

export const studentIdParamSchema = z.object({
  id: actorIdSchema(['A', 'I']),
})

export const courseCodeParamSchema = z.object({
  code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const enrollSchema = z.object({
  studentId: actorIdSchema(['A', 'I']),
  courseCode: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const dropSchema = z.object({
  studentId: actorIdSchema(['A', 'I']),
  courseCode: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const gradeSchema = z.object({
  enrollmentId: z.string().uuid(),
  grade: z.union([z.number().min(gradeScaleMin).max(gradeScaleMax), z.null()]),
})

export const enrollmentStatusSchema = z.enum(['pending', 'approved', 'rejected'])

export const enrollmentRecordSchema = z.object({
  id: z.string().uuid(),
  studentId: actorIdSchema(['A', 'I']),
  courseCode: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  status: enrollmentStatusSchema,
  section: z.string().trim().min(1),
  instructorId: actorIdSchema(['R', 'F']).nullable(),
  grade: z.union([z.number().min(gradeScaleMin).max(gradeScaleMax), z.null()]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const notificationReadStatusSchema = z.enum(['unread', 'read'])

export const notificationSchema = z.object({
  id: z.string().uuid(),
  studentId: actorIdSchema(['A', 'I']),
  message: z.string().trim().min(1),
  timestamp: z.string().datetime(),
  readStatus: notificationReadStatusSchema,
})

export const adminDecisionSchema = z.object({
  action: z.enum(['approve', 'deny']),
})

export const enrollmentIdParamSchema = z.object({
  id: z.string().uuid(),
})

const humanActorIdSchema = actorIdSchema(['A', 'I', 'R', 'F'])

export const loginSchema = z.object({
  username: humanActorIdSchema,
  password: z.string().trim().min(1),
})

type ValidationFailureResult = {
  success: false
  error: {
    issues: ZodIssue[]
  }
}

type ValidationHookOptions = {
  fieldAliases?: Record<string, string>
  fieldMessages?: Record<string, string>
  tokenFieldMessages?: Record<string, string>
  statusCode?: number
  fieldName?: string
  errorMessage?: string
}

function isValidationFailure(result: unknown): result is ValidationFailureResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    (result as { success?: unknown }).success === false &&
    'error' in result &&
    typeof (result as { error?: unknown }).error === 'object' &&
    (result as { error?: { issues?: unknown } }).error !== null &&
    Array.isArray((result as { error?: { issues?: unknown } }).error?.issues)
  )
}

function getValidationField(issue: ZodIssue, fieldAliases: Record<string, string>) {
  const rawField = String(issue.path[0] ?? 'input')

  return fieldAliases[rawField] ?? rawField
}

function formatValidationError(
  field: string,
  issue: ZodIssue,
  options: ValidationHookOptions,
) {
  const aliasedMessage = options.fieldMessages?.[field]

  if (aliasedMessage) {
    return aliasedMessage
  }

  const tokenMessage = options.tokenFieldMessages?.[field]

  if (tokenMessage) {
    return tokenMessage
  }

  switch (issue.code) {
    case 'invalid_type':
      return `Invalid ${field}. Expected ${issue.expected}.`
    case 'invalid_format':
      return `Invalid ${field} format.`
    case 'too_small':
      if (issue.origin === 'string' && issue.minimum === 1) {
        return `Invalid ${field}. Must not be empty.`
      }

      return `Invalid ${field}. Must be at least ${issue.minimum}.`
    case 'too_big':
      return `Invalid ${field}. Must be at most ${issue.maximum}.`
    case 'unrecognized_keys':
      return `Invalid input. Unrecognized key ${issue.keys[0]}.`
    case 'custom':
      return issue.message ? `Invalid ${field}. ${issue.message}` : `Invalid ${field}.`
    default:
      return issue.message ? `Invalid ${field}. ${issue.message}` : `Invalid ${field}.`
  }
}

export function createValidationErrorHook(options: ValidationHookOptions = {}) {
  return (result: unknown, c: Context) => {
    if (!isValidationFailure(result)) {
      return
    }

    const issue = result.error.issues[0]
    const statusCode = options.statusCode ?? 400

    if (!issue) {
      return c.json(
        {
          success: false,
          error: options.errorMessage ?? 'Invalid input.',
          field: options.fieldName ?? 'input',
        },
        statusCode,
      )
    }

    const field = options.fieldName ?? getValidationField(issue, options.fieldAliases ?? {})

    return c.json(
      {
        success: false,
        error: options.errorMessage ?? formatValidationError(field, issue, options),
        field,
      },
      statusCode,
    )
  }
}

const studentTokenMessage = 'Invalid student ID format. Expected 2026-XXXX-A or 2026-XXXX-I.'
const enrollmentTokenMessage = 'Invalid enrollment ID format. Expected a UUID.'
const loginFailureMessage = 'Invalid credentials provided. Please check your ID and password.'

export const studentValidationHook = createValidationErrorHook({
  fieldAliases: { id: 'studentId' },
  tokenFieldMessages: { studentId: studentTokenMessage },
})

export const courseValidationHook = createValidationErrorHook({
  fieldAliases: { code: 'courseCode' },
})

export const enrollmentValidationHook = createValidationErrorHook({
  tokenFieldMessages: {
    studentId: studentTokenMessage,
    enrollmentId: enrollmentTokenMessage,
  },
})

export const loginValidationHook = createValidationErrorHook({
  statusCode: 401,
  fieldName: 'auth',
  errorMessage: loginFailureMessage,
})