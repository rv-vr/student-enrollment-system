import { z } from 'zod'

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