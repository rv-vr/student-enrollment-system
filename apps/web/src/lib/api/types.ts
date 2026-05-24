export type AuthRole = "student" | "instructor" | "admin";

export type AuthUser = {
  id: string;
  role: AuthRole;
  name: string;
};

export type LoginResponse = {
  success: true;
  token: string;
  user: AuthUser;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
  field: string;
};

export type Student = {
  id: string;
  name: string;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  capacity: number;
  labCredits: number;
  lecCredits: number;
  prerequisites: string[];
  prerequisiteCodes: string[];
  instructorId?: string | null;
  schedule?: string;
};

export type CourseCatalogEntry = Course & {
  enrolledCount: number;
  remainingSeats: number;
};

export type CourseAvailability = {
  course: Course;
  enrolledCount: number;
  remainingSeats: number;
  hasCapacity: boolean;
};

export type EnrollmentRecord = {
  id: string;
  studentId: string;
  courseCode: string;
  grade?: number | null;
  createdAt: string;
  updatedAt: string;
  student?: Student;
  course?: Course;
};

export type StudentCoursesResponse = {
  student: Student;
  completedCourses: Course[];
  enrollments: EnrollmentRecord[];
};

export type MutationAvailability = {
  capacity: number;
  enrolledCount: number;
  remainingSeats: number;
};

export type MutationResponse = {
  message: string;
  enrollment?: EnrollmentRecord;
  availability?: MutationAvailability;
  prerequisites?: string[];
};
