import { z } from 'zod'

export const studentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const courseCodeParamSchema = z.object({
  code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const enrollSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  courseCode: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const dropSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  courseCode: z.string().trim().min(1).transform((value) => value.toUpperCase()),
})

export const gradeSchema = z.object({
  enrollmentId: z.string().uuid(),
  grade: z.union([z.number(), z.string().trim().min(1)]),
})