import type { AppType } from 'api'
import { hc } from 'hono/client'
import type {
  CourseAvailability,
  CourseCatalogEntry,
  MutationResponse,
  StudentCoursesResponse,
} from './types'

const client = hc<AppType>('http://localhost:8787')

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message?: unknown }).message)
        : `Request failed with status ${response.status}`

    throw new Error(message)
  }

  return data as T
}

export async function getCourses() {
  return readJson<CourseCatalogEntry[]>(await client.courses.$get())
}

export async function getCourseAvailability(courseCode: string) {
  return readJson<CourseAvailability>(
    await client.courses[':code'].availability.$get({
      param: { code: courseCode },
    }),
  )
}

export async function getStudentCourses(studentId: number) {
  return readJson<StudentCoursesResponse>(
    await client.students[':id'].courses.$get({
      param: { id: String(studentId) },
    }),
  )
}

export async function enrollStudent(studentId: number, courseCode: string) {
  return readJson<MutationResponse>(
    await client.enroll.$post({
      json: { studentId, courseCode: courseCode.toUpperCase() },
    }),
  )
}

export async function dropStudentCourse(studentId: number, courseCode: string) {
  return readJson<MutationResponse>(
    await client.drop.$post({
      json: { studentId, courseCode: courseCode.toUpperCase() },
    }),
  )
}

export async function updateEnrollmentGrade(enrollmentId: string, grade: number | string) {
  return readJson<MutationResponse>(
    await client.grade.$patch({
      json: { enrollmentId, grade },
    }),
  )
}