export type Student = {
  id: string
  name: string
  section: string
}

export type Course = {
  code: string
  title: string
  capacity: number
  prerequisiteCodes: string[]
  schedule: string
  assignedTeacherId: string | null
}

export type GradeValue = number | null

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'DENIED'

export type Instructor = {
  id: string
  name: string
  taughtCourseCodes: string[]
}

export type Admin = {
  id: string
  name: string
}

export type Enrollment = {
  id: string
  studentId: string
  courseCode: string
  approvalStatus: ApprovalStatus
  section: string
  instructorId: string | null
  grade: GradeValue
  createdAt: string
  updatedAt: string
}

// Grade scale: lower numbers are better. 1.00 is the highest mark, 5.00 is the failing edge.
export const gradeScaleMin = 1
export const gradeScaleMax = 5
export const passingGradeThreshold = 3.0

function makeEntityId(code: 'S' | 'I' | 'A' | 'E', digits: string) {
  return `2026-${digits}-${code}`
}

export const students: Student[] = [
  { id: makeEntityId('S', '1842'), name: 'Ava M. Patel', section: 'Section A' },
  { id: makeEntityId('S', '5927'), name: 'Noah T. Kim', section: 'Section B' },
  { id: makeEntityId('S', '7403'), name: 'Mia R. Garcia', section: 'Section A' },
]

export const instructors: Instructor[] = [
  {
    id: makeEntityId('I', '2814'),
    name: 'Ethan J. Moore',
    taughtCourseCodes: ['CS101', 'CS102'],
  },
  {
    id: makeEntityId('I', '9056'),
    name: 'Lena K. Reed',
    taughtCourseCodes: ['CS201'],
  },
]

export const admins: Admin[] = [{ id: makeEntityId('A', '1338'), name: 'Grace L. Chen' }]

export const courses: Course[] = [
  {
    code: 'CS101',
    title: 'Introduction to Computer Science',
    capacity: 2,
    prerequisiteCodes: [],
    schedule: 'Mon/Wed 09:00-10:30',
    assignedTeacherId: instructors[0].id,
  },
  {
    code: 'CS102',
    title: 'Data Structures',
    capacity: 30,
    prerequisiteCodes: ['CS101'],
    schedule: 'Tue/Thu 10:45-12:15',
    assignedTeacherId: instructors[0].id,
  },
  {
    code: 'CS201',
    title: 'Systems Programming',
    capacity: 1,
    prerequisiteCodes: ['CS102'],
    schedule: 'Fri 13:00-15:00',
    assignedTeacherId: instructors[1].id,
  },
]

export const enrollments: Enrollment[] = [
  {
    id: makeEntityId('E', '4471'),
    studentId: students[0].id,
    courseCode: 'CS101',
    approvalStatus: 'APPROVED',
    section: students[0].section,
    instructorId: courses[0].assignedTeacherId,
    grade: 1.25,
    createdAt: '2026-05-19T08:00:00.000Z',
    updatedAt: '2026-05-19T08:00:00.000Z',
  },
  {
    id: makeEntityId('E', '8820'),
    studentId: students[1].id,
    courseCode: 'CS102',
    approvalStatus: 'PENDING',
    section: students[1].section,
    instructorId: courses[1].assignedTeacherId,
    grade: null,
    createdAt: '2026-05-19T08:15:00.000Z',
    updatedAt: '2026-05-19T08:15:00.000Z',
  },
]

export function getStudent(studentId: string) {
  return students.find((student) => student.id === studentId)
}

export function getInstructor(instructorId: string) {
  return instructors.find((instructor) => instructor.id === instructorId)
}

export function getAdmin(adminId: string) {
  return admins.find((admin) => admin.id === adminId)
}

export function getCourse(courseCode: string) {
  return courses.find((course) => course.code === courseCode)
}

export function getEnrollment(enrollmentId: string) {
  return enrollments.find((enrollment) => enrollment.id === enrollmentId)
}

export function getEnrollmentsForStudent(studentId: string) {
  return enrollments.filter((enrollment) => enrollment.studentId === studentId)
}

export function getEnrollmentsForCourse(courseCode: string) {
  return enrollments.filter((enrollment) => enrollment.courseCode === courseCode)
}

export function isPassingGrade(grade: GradeValue) {
  return grade !== null && grade <= passingGradeThreshold
}

export function hasPassedCourse(studentId: string, courseCode: string) {
  return enrollments.some(
    (enrollment) =>
      enrollment.studentId === studentId &&
      enrollment.courseCode === courseCode &&
      enrollment.approvalStatus === 'APPROVED' &&
      isPassingGrade(enrollment.grade),
  )
}

export function hasActiveEnrollment(studentId: string, courseCode: string) {
  return enrollments.some(
    (enrollment) =>
      enrollment.studentId === studentId && enrollment.courseCode === courseCode,
  )
}

export function getCompletedCourses(studentId: string) {
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

export function hasSatisfiedPrerequisites(studentId: string, course: Course) {
  return course.prerequisiteCodes.every((prerequisiteCode) =>
    hasPassedCourse(studentId, prerequisiteCode),
  )
}

export function createEnrollment(studentId: string, courseCode: string) {
  const timestamp = new Date().toISOString()
  const student = getStudent(studentId)
  const course = getCourse(courseCode)

  if (!student || !course) {
    return undefined
  }

  const enrollment: Enrollment = {
    id: makeEntityId('E', String(Math.floor(1000 + Math.random() * 9000))),
    studentId,
    courseCode,
    approvalStatus: 'PENDING',
    section: student.section,
    instructorId: course.assignedTeacherId,
    grade: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  enrollments.push(enrollment)

  return enrollment
}

export function removeEnrollment(studentId: string, courseCode: string) {
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
  const instructor = enrollment.instructorId
    ? getInstructor(enrollment.instructorId)
    : undefined

  return {
    ...enrollment,
    student,
    course,
    instructor,
  }
}