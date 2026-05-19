import { z } from 'zod'

import { gradeScaleMax, gradeScaleMin } from './store'

const tokenIdSchema = (suffix: 'S' | 'I' | 'A' | 'E') =>
  z.string().regex(new RegExp(`^2026-\\d{4}-${suffix}$`))

export const studentIdParamSchema = z.object({
  id: tokenIdSchema('S'),
})

export const courseCodeParamSchema = z.object({
  code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const enrollSchema = z.object({
  studentId: tokenIdSchema('S'),
  courseCode: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const dropSchema = z.object({
  studentId: tokenIdSchema('S'),
  courseCode: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const gradeSchema = z.object({
  enrollmentId: tokenIdSchema('E'),
  grade: z.union([z.number().min(gradeScaleMin).max(gradeScaleMax), z.null()]),
})