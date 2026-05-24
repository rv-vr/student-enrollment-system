import type { AppType } from "api";
import { hc } from "hono/client";
import { getAuthHeaders } from "$lib/stores/auth";
import type {
  ApiErrorResponse,
  CourseAvailability,
  CourseCatalogEntry,
  LoginResponse,
  MutationResponse,
  PublicUsersResponse,
  SectionCatalogResponse,
  SectionCatalogEntry,
  SectionScheduleEntry,
  StudentCoursesResponse,
} from "./types";
import type { InferResponseType } from "hono/client";
import { PUBLIC_LOCAL_API, PUBLIC_PROD_API } from "$env/static/public";
import { dev } from "$app/environment";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: ApiErrorResponse | Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// API base URL is driven by an environment variable so it can be changed per-deploy
// Set PROD_API in your dev/.env or in your CI/Cloudflare Pages environment.
// Fallbacks: LOCAL_API -> PROD_API
export const API_BASE = dev
  ? (PUBLIC_LOCAL_API as string)
  : (PUBLIC_PROD_API as string);

const client = hc<AppType>(API_BASE, {
  headers: () => getAuthHeaders(),
});

const studentNotificationsGet = client.students[":id"].notifications.$get;

export type InstructorClassesResponse = InferResponseType<
  typeof client.instructor.classes.$get
>;

export type AdminRequestsResponse = InferResponseType<
  typeof client.admin.requests.$get
>;

export type AdminUsersResponse = InferResponseType<
  typeof client.admin.users.$get
>;

export type AdminUser = AdminUsersResponse["users"][number];

export type AdminUserCreatePayload = {
  name: string;
  password: string;
  role: "student" | "instructor" | "admin";
  college?: string;
  program?: string;
  campus?: string;
};

export type AdminCourseCreatePayload = {
  id: string;
  title: string;
  description?: string;
  capacity: number;
  labCredits: number;
  lecCredits: number;
  prerequisites?: string[];
};

export type SectionCreatePayload = {
  courseCode: string;
  instructorId: string;
  sectionName: string;
  capacity: number;
  scheduleArray: SectionScheduleEntry[];
};

export type StudentNotificationsResponse = InferResponseType<
  typeof studentNotificationsGet
>;

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const payload =
      data && typeof data === "object"
        ? (data as ApiErrorResponse | Record<string, unknown>)
        : {};
    const message =
      typeof (payload as ApiErrorResponse).error === "string"
        ? (payload as ApiErrorResponse).error
        : typeof (payload as { message?: unknown }).message === "string"
          ? String((payload as { message?: unknown }).message)
          : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return data as T;
}

export async function loginWithCredentials(username: string, password: string) {
  return readJson<LoginResponse>(
    await client.auth.login.$post({
      json: {
        username,
        password,
      },
    }),
  );
}

export async function getCourses() {
  return readJson<CourseCatalogEntry[]>(await client.courses.$get());
}

export async function getInstructorClasses() {
  return readJson<InstructorClassesResponse>(
    await client.instructor.classes.$get(),
  );
}

export async function getAdminRequests() {
  return readJson<AdminRequestsResponse>(await client.admin.requests.$get());
}

export async function getAdminUsers() {
  return readJson<AdminUsersResponse>(await client.admin.users.$get());
}

export async function getUsers(role?: "student" | "instructor" | "admin") {
  const query = role ? { role } : {};

  return readJson<PublicUsersResponse>(
    await client.users.$get({
      query,
    }),
  );
}

export async function createAdminUser(payload: AdminUserCreatePayload) {
  return readJson<{ user: AdminUser }>(
    await client.admin.users.$post({
      json: payload,
    }),
  );
}

export async function createAdminCourse(payload: AdminCourseCreatePayload) {
  return readJson<{ course: CourseCatalogEntry }>(
    await client.courses.$post({
      json: payload,
    }),
  );
}

export async function getSections() {
  return readJson<SectionCatalogResponse>(await client.sections.$get());
}

export async function createSection(payload: SectionCreatePayload) {
  return readJson<{ section: SectionCatalogEntry }>(
    await client.sections.$post({
      json: payload,
    }),
  );
}

export async function decideAdminRequest(
  enrollmentId: string,
  action: "approve" | "deny",
) {
  return readJson<MutationResponse>(
    await client.admin.requests[":id"].decide.$patch({
      param: { id: enrollmentId },
      json: { action },
    }),
  );
}

export async function getCourseAvailability(courseCode: string) {
  return readJson<CourseAvailability>(
    await client.courses[":code"].availability.$get({
      param: { code: courseCode },
    }),
  );
}

export async function getStudentCourses(studentId: string) {
  return readJson<StudentCoursesResponse>(
    await client.students[":id"].courses.$get({
      param: { id: String(studentId) },
    }),
  );
}

export async function getStudentNotifications(studentId: string) {
  return readJson<StudentNotificationsResponse>(
    await studentNotificationsGet({
      param: { id: String(studentId) },
    }),
  );
}

export async function enrollStudent(studentId: string, courseCode: string) {
  return readJson<MutationResponse>(
    await client.enroll.$post({
      json: { studentId, courseCode: courseCode.toUpperCase() },
    }),
  );
}

export async function dropStudentCourse(studentId: string, courseCode: string) {
  return readJson<MutationResponse>(
    await client.drop.$post({
      json: { studentId, courseCode: courseCode.toUpperCase() },
    }),
  );
}

export async function updateEnrollmentGrade(
  enrollmentId: string,
  grade: number | string,
) {
  // Prefer path-based grade endpoint when available
  return readJson<MutationResponse>(
    await client["enrollments"][":id"].grade.$patch({
      param: { id: String(enrollmentId) },
      json: { grade: grade === "" ? null : Number(grade) },
    }),
  );
}
