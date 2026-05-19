import { Hono } from 'hono'
import { authRoutes } from './routes/auth'
import { coursesRoutes } from './routes/courses'
import { enrollmentsRoutes } from './routes/enrollments'
import { studentsRoutes } from './routes/students'

const app = new Hono()

app.get('/', (c) => {
  return c.json({
    name: 'Course Enrollment System API',
    routes: [
      '/auth/login',
      '/courses',
      '/courses/:code/availability',
      '/students/:id/courses',
      '/enroll',
      '/drop',
      '/grade',
    ],
  })
})

app.route('/auth', authRoutes)
app.route('/courses', coursesRoutes)
app.route('/students', studentsRoutes)
app.route('/', enrollmentsRoutes)

export const routes = app
export type AppType = typeof routes

export default routes