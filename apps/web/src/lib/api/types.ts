export type Student = {
  id: number
  name: string
}

export type Course = {
  code: string
  title: string
  capacity: number
  prerequisiteCodes: string[]
}

export type CourseCatalogEntry = Course & {
  enrolledCount: number
  remainingSeats: number
}

export type CourseAvailability = {
  course: Course
  enrolledCount: number
  remainingSeats: number
  hasCapacity: boolean
}

export type EnrollmentRecord = {
  id: string
  studentId: number
  courseCode: string
  grade?: number | string
  createdAt: string
  updatedAt: string
  student?: Student
  course?: Course
}

export type StudentCoursesResponse = {
  student: Student
  completedCourses: Course[]
  enrollments: EnrollmentRecord[]
}

export type MutationAvailability = {
  capacity: number
  enrolledCount: number
  remainingSeats: number
}

export type MutationResponse = {
  message: string
  enrollment?: EnrollmentRecord
  availability?: MutationAvailability
  prerequisites?: string[]
}