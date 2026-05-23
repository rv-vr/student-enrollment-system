import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { requireAuth, type AppVariables } from '../auth'
import {
  buildEnrollmentView,
  createNotification,
  getCourse,
  getEnrollment,
  getPendingEnrollments,
  getRemainingSeats,
  updateEnrollmentStatus,
} from '../store'
import {
  adminDecisionSchema,
  enrollmentIdParamSchema,
  enrollmentValidationHook,
} from '../validators'

export const adminRoutes = new Hono<{ Variables: AppVariables }>()

adminRoutes.use('*', requireAuth)
adminRoutes.use('*', (c, next) => {
  const user = c.get('user')

  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
  }

  return next()
})

adminRoutes.get('/requests', (c) => {
  const pending = getPendingEnrollments().map((enrollment) => buildEnrollmentView(enrollment))

  return c.json({ requests: pending })
})

adminRoutes.patch(
  '/requests/:id/decide',
  zValidator('param', enrollmentIdParamSchema, enrollmentValidationHook),
  zValidator('json', adminDecisionSchema, enrollmentValidationHook),
  (c) => {
    const { id } = c.req.valid('param')
    const { action } = c.req.valid('json')

    const enrollment = getEnrollment(id)

    if (!enrollment) {
      return c.json({ message: 'Enrollment request not found' }, 404)
    }

    if (enrollment.status !== 'pending') {
      return c.json({ message: 'Enrollment request already decided' }, 409)
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected'

    if (nextStatus === 'approved') {
      const course = getCourse(enrollment.courseCode)

      if (!course) {
        return c.json({ message: 'Course not found' }, 404)
      }

      if (getRemainingSeats(course.code) <= 0) {
        return c.json({ message: 'Course is full. Request cannot be approved.' }, 409)
      }
    }

    const updatedEnrollment = updateEnrollmentStatus(id, nextStatus)

    if (!updatedEnrollment) {
      return c.json({ message: 'Enrollment request not found' }, 404)
    }

    const notificationMessage =
      nextStatus === 'approved'
        ? `Your enrollment in ${updatedEnrollment.courseCode} was approved.`
        : `Your enrollment in ${updatedEnrollment.courseCode} was denied.`

    const notification = createNotification(updatedEnrollment.studentId, notificationMessage)

    return c.json({
      message: 'Enrollment request decision recorded',
      enrollment: buildEnrollmentView(updatedEnrollment),
      notification,
    })
  },
)
