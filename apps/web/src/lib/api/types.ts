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
  username?: string;
};

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  role: AuthRole;
  college?: string | null;
  program?: string | null;
  campus?: string | null;
};

export type SectionScheduleEntry = {
  day: string;
  time: string;
  type: string;
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

export type SectionCatalogEntry = {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  instructorId: string;
  instructorName: string;
  sectionName: string;
  capacity: number;
  scheduleArray: SectionScheduleEntry[];
  enrolledCount: number;
  remainingSeats: number;
};

export type SectionCatalogResponse = {
  sections: SectionCatalogEntry[];
};

export type PublicUsersResponse = {
  users: PublicUser[];
};

export type CourseAvailability = {
  course: Course;
  enrolledCount: number;
  remainingSeats: number;
  hasCapacity: boolean;
};

export type EnrollmentRecord = {
  id: string;
  userId?: string;
  studentId: string;
  courseCode: string;
  status: string;
  sectionId: string;
  scheduleArray?: SectionScheduleEntry[];
  grade?: number | null;
  remark?: string | null;
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

export type InstructorRosterStudent = {
  id: string;
  username: string;
  name: string;
};

export type InstructorRosterEntry = {
  id: string;
  userId: string;
  studentId: string;
  courseId: string;
  sectionId: string;
  status: string;
  section: null;
  scheduleArray: unknown[];
  dateRequested: string;
  dateEnrolled: string;
  grade: number | null;
  remark: string | null;
  student: InstructorRosterStudent | null;
};

export type InstructorSectionSummary = {
  id: string;
  courseId: string;
  instructorId: string;
  sectionName: string;
  capacity: number;
  scheduleArray: SectionScheduleEntry[];
  courseCode: string;
  courseTitle: string;
  enrolledCount: number;
  remainingSeats: number;
};

export type InstructorSectionBundle = {
  section: InstructorSectionSummary;
  course: Record<string, unknown>;
  roster: InstructorRosterEntry[];
};

export type InstructorSectionsResponse = {
  sections: InstructorSectionBundle[];
};

export type AdminRosterStudent = {
  id: string;
  username: string;
  name: string;
};

export type AdminRosterEntry = {
  id: string;
  userId: string;
  studentId: string;
  courseId: string;
  sectionId: string;
  status: string;
  dateRequested: string;
  dateEnrolled: string | null;
  grade: number | null;
  remark: string | null;
  student: AdminRosterStudent;
};
