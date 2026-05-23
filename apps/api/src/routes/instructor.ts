import { Hono } from 'hono'
import { requireAuth, type AppVariables } from '../auth'
import { getEnrollmentsForCourse, buildEnrollmentView, courses } from '../store'

export const instructorRoutes = new Hono<{ Variables: AppVariables }>()

instructorRoutes.use('*', requireAuth)

instructorRoutes.get('/classes', (c) => {
  const user = c.get('user')

  if (user.role !== 'instructor') {
    return c.json({ success: false, error: 'Forbidden', field: 'auth' }, 403)
  }

  // Filter courses assigned to this instructor
  const assigned = courses.filter((course) => course.assignedTeacherId === user.id)

  const payload = assigned.map((course) => {
    const roster = getEnrollmentsForCourse(course.code).map(buildEnrollmentView)

    return {
      course,
      roster,
    }
  })

  return c.json({ classes: payload })
})
