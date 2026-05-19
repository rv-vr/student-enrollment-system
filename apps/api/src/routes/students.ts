import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { studentIdParamSchema, studentValidationHook } from '../validators'
import {
  buildEnrollmentView,
  getCompletedCourses,
  getEnrollmentsForStudent,
  getStudent,
} from '../store'

export const studentsRoutes = new Hono()

studentsRoutes.get('/:id/courses', zValidator('param', studentIdParamSchema, studentValidationHook), (c) => {
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