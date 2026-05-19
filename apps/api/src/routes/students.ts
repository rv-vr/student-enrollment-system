import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { requireAuth, type AppVariables } from '../auth'
import { studentIdParamSchema, studentValidationHook } from '../validators'
import {
  buildEnrollmentView,
  getCompletedCourses,
  getEnrollmentsForStudent,
  getStudent,
} from '../store'

export const studentsRoutes = new Hono<{ Variables: AppVariables }>()

studentsRoutes.use('*', requireAuth)

studentsRoutes.get('/:id/courses', zValidator('param', studentIdParamSchema, studentValidationHook), (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const student = getStudent(id)

    if (user.role === 'student' && user.id !== id) {
      return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
    }

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