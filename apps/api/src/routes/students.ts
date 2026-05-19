import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { studentIdParamSchema } from '../validators'
import {
  buildEnrollmentView,
  getCompletedCourses,
  getEnrollmentsForStudent,
  getStudent,
} from '../store'

export const studentsRoutes = new Hono()

studentsRoutes.get(
  '/:id/courses',
  zValidator('param', studentIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Invalid student ID format. Expected 2026-XXXX-A or 2026-XXXX-I.',
        },
        400,
      )
    }
  }),
  (c) => {
    const { id } = c.req.valid('param')
    const student = getStudent(id)

    if (!student) {
      return c.json({ message: 'Student not found' }, 404)
    }

    const enrollments = getEnrollmentsForStudent(student.id)

    return c.json({
      student,
      completedCourses: getCompletedCourses(student.id),
      enrollments: enrollments.map(buildEnrollmentView),
    })
  },
)