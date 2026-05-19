import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { requireAuth, type AppVariables } from '../auth'
import {
  dropSchema,
  enrollSchema,
  enrollmentValidationHook,
  gradeSchema,
} from '../validators'
import {
  buildEnrollmentView,
  createEnrollment,
  getCourse,
  getEnrollment,
  getRemainingSeats,
  getStudent,
  hasActiveEnrollment,
  hasPassedCourse,
  hasSatisfiedPrerequisites,
  isPassingGrade,
  removeEnrollment,
  updateEnrollmentGrade,
} from '../store'

export const enrollmentsRoutes = new Hono<{ Variables: AppVariables }>()

enrollmentsRoutes.use('*', requireAuth)

enrollmentsRoutes.post('/enroll', zValidator('json', enrollSchema, enrollmentValidationHook), (c) => {
  const user = c.get('user')
  const { studentId, courseCode } = c.req.valid('json')

  if (user.role !== 'student') {
    return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
  }

  if (user.id !== studentId) {
    return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
  }

  const student = getStudent(studentId)

  if (!student) {
    return c.json({ message: 'Student not found' }, 404)
  }

  const course = getCourse(courseCode)

  if (!course) {
    return c.json({ message: 'Course not found' }, 404)
  }

  if (hasPassedCourse(student.id, course.code)) {
    return c.json({ message: 'Student already passed this course' }, 409)
  }

  if (hasActiveEnrollment(student.id, course.code)) {
    return c.json({ message: 'Student already enrolled in this course' }, 409)
  }

  if (getRemainingSeats(course.code) <= 0) {
    return c.json({ message: 'Course is full' }, 409)
  }

  if (!hasSatisfiedPrerequisites(student.id, course)) {
    return c.json(
      {
        message: 'Prerequisites not satisfied',
        prerequisites: course.prerequisiteCodes,
      },
      400,
    )
  }

  const enrollment = createEnrollment(student.id, course.code)
  if (!enrollment) {
    return c.json({ message: 'Unable to create enrollment' }, 500)
  }
  const remainingSeats = getRemainingSeats(course.code)

  return c.json(
    {
      message: 'Enrollment created',
      enrollment: buildEnrollmentView(enrollment),
      availability: {
        capacity: course.capacity,
        enrolledCount: course.capacity - remainingSeats,
        remainingSeats,
      },
    },
    201,
  )
})

enrollmentsRoutes.post('/drop', zValidator('json', dropSchema, enrollmentValidationHook), (c) => {
  const user = c.get('user')
  const { studentId, courseCode } = c.req.valid('json')

  if (user.role !== 'student') {
    return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
  }

  if (user.id !== studentId) {
    return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
  }

  const course = getCourse(courseCode)

  if (!course) {
    return c.json({ message: 'Course not found' }, 404)
  }

  const removedEnrollment = removeEnrollment(studentId, course.code)

  if (!removedEnrollment) {
    return c.json({ message: 'Enrollment not found' }, 404)
  }

  const remainingSeats = getRemainingSeats(course.code)

  return c.json({
    message: 'Enrollment dropped',
    enrollment: buildEnrollmentView(removedEnrollment),
    availability: {
      capacity: course.capacity,
      enrolledCount: course.capacity - remainingSeats,
      remainingSeats,
    },
  })
})

enrollmentsRoutes.patch('/grade', zValidator('json', gradeSchema, enrollmentValidationHook), (c) => {
  const user = c.get('user')
  const { enrollmentId, grade } = c.req.valid('json')

  if (user.role === 'student') {
    return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
  }

  const enrollment = getEnrollment(enrollmentId)

  if (!enrollment) {
    return c.json({ message: 'Enrollment not found' }, 404)
  }

  const updatedEnrollment = updateEnrollmentGrade(enrollmentId, grade)

  if (!updatedEnrollment) {
    return c.json({ message: 'Enrollment not found' }, 404)
  }

  return c.json({
    message:
      updatedEnrollment.grade === null
        ? 'Grade cleared'
        : isPassingGrade(updatedEnrollment.grade)
          ? 'Passing grade recorded'
          : 'Grade recorded',
    enrollment: buildEnrollmentView(updatedEnrollment),
  })
})