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

    if (!issue) {
      return c.json(
        {
          success: false,
          error: 'Invalid input.',
          field: 'input',
        },
        400,
      )
    }

    const field = getValidationField(issue, options.fieldAliases ?? {})

    return c.json(
      {
        success: false,
        error: formatValidationError(field, issue, options),
        field,
      },
      400,
    )
  }
}

const studentTokenMessage = 'Invalid student ID format. Expected 2026-XXXX-A or 2026-XXXX-I.'
const enrollmentTokenMessage = 'Invalid enrollment ID format. Expected a UUID.'

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