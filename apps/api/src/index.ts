import { Hono } from 'hono'
import { coursesRoutes } from './routes/courses'
import { enrollmentsRoutes } from './routes/enrollments'
import { studentsRoutes } from './routes/students'

const app = new Hono()

app.get('/', (c) => {
  return c.json({
    name: 'Course Enrollment System API',
    routes: [
      '/courses',
      '/courses/:code/availability',
      '/students/:id/courses',
      '/enroll',
      '/drop',
      '/grade',
    ],
  })
})

app.route('/courses', coursesRoutes)
app.route('/students', studentsRoutes)
app.route('/', enrollmentsRoutes)

export const routes = app
export type AppType = typeof routes

export default routes