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

export type GradeValue = number | string

export type Enrollment = {
  id: string
  studentId: number
  courseCode: string
  grade?: GradeValue
  createdAt: string
  updatedAt: string
}

export const students: Student[] = [
  { id: 1, name: 'Ava Patel' },
  { id: 2, name: 'Noah Kim' },
  { id: 3, name: 'Mia Garcia' },
]

export const courses: Course[] = [
  {
    code: 'CS101',
    title: 'Introduction to Computer Science',
    capacity: 2,
    prerequisiteCodes: [],
  },
  {
    code: 'CS102',
    title: 'Data Structures',
    capacity: 30,
    prerequisiteCodes: ['CS101'],
  },
  {
    code: 'CS201',
    title: 'Systems Programming',
    capacity: 1,
    prerequisiteCodes: [],
  },
]

export const enrollments: Enrollment[] = []

const passingLetterGrades = new Set([
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
])

export function getStudent(studentId: number) {
  return students.find((student) => student.id === studentId)
}

export function getCourse(courseCode: string) {
  return courses.find((course) => course.code === courseCode)
}

export function getEnrollment(enrollmentId: string) {
  return enrollments.find((enrollment) => enrollment.id === enrollmentId)
}

export function getEnrollmentsForStudent(studentId: number) {
  return enrollments.filter((enrollment) => enrollment.studentId === studentId)
}

export function getEnrollmentsForCourse(courseCode: string) {
  return enrollments.filter((enrollment) => enrollment.courseCode === courseCode)
}

export function isPassingGrade(grade?: GradeValue) {
  if (grade === undefined) {
    return false
  }

  if (typeof grade === 'number') {
    return grade >= 60
  }

  const normalizedGrade = grade.trim().toUpperCase()

  if (normalizedGrade === '') {
    return false
  }

  const numericGrade = Number(normalizedGrade)
  if (!Number.isNaN(numericGrade)) {
    return numericGrade >= 60
  }

  return passingLetterGrades.has(normalizedGrade)
}

export function hasPassedCourse(studentId: number, courseCode: string) {
  return enrollments.some(
    (enrollment) =>
      enrollment.studentId === studentId &&
      enrollment.courseCode === courseCode &&
      isPassingGrade(enrollment.grade),
  )
}

export function hasActiveEnrollment(studentId: number, courseCode: string) {
  return enrollments.some(
    (enrollment) =>
      enrollment.studentId === studentId && enrollment.courseCode === courseCode,
  )
}

export function getCompletedCourses(studentId: number) {
  return courses.filter((course) => hasPassedCourse(studentId, course.code))
}

export function getActiveEnrollmentCount(courseCode: string) {
  return getEnrollmentsForCourse(courseCode).length
}

export function getRemainingSeats(courseCode: string) {
  const course = getCourse(courseCode)

  if (!course) {
    return 0
  }

  return Math.max(course.capacity - getActiveEnrollmentCount(courseCode), 0)
}

export function hasSatisfiedPrerequisites(studentId: number, course: Course) {
  return course.prerequisiteCodes.every((prerequisiteCode) =>
    hasPassedCourse(studentId, prerequisiteCode),
  )
}

export function createEnrollment(studentId: number, courseCode: string) {
  const timestamp = new Date().toISOString()

  const enrollment: Enrollment = {
    id: crypto.randomUUID(),
    studentId,
    courseCode,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  enrollments.push(enrollment)

  return enrollment
}

export function removeEnrollment(studentId: number, courseCode: string) {
  const index = enrollments.findIndex(
    (enrollment) =>
      enrollment.studentId === studentId && enrollment.courseCode === courseCode,
  )

  if (index === -1) {
    return undefined
  }

  const [removedEnrollment] = enrollments.splice(index, 1)
  return removedEnrollment
}

export function updateEnrollmentGrade(enrollmentId: string, grade: GradeValue) {
  const enrollment = getEnrollment(enrollmentId)

  if (!enrollment) {
    return undefined
  }

  enrollment.grade = grade
  enrollment.updatedAt = new Date().toISOString()

  return enrollment
}

export function buildEnrollmentView(enrollment: Enrollment) {
  const student = getStudent(enrollment.studentId)
  const course = getCourse(enrollment.courseCode)

  return {
    ...enrollment,
    student,
    course,
  }
}