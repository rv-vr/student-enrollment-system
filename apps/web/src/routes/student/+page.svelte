<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import {
    client,
    getCourses,
    getSections,
    getStudentCourses,
  } from "$lib/api/client";
  import type {
    CourseCatalogEntry,
    SectionCatalogEntry,
    SectionScheduleEntry,
    StudentCoursesResponse,
  } from "$lib/api/types";
  import { authSession } from "$lib/stores/auth";

  type StudentSection = SectionCatalogEntry & {
    credits: number;
  };

  type StudentEnrollmentView = {
    id: string;
    courseCode: string;
    courseTitle: string;
    sectionName: string;
    instructorName: string;
    scheduleArray: SectionScheduleEntry[];
    status: string;
    grade: number | null;
    remark: string | null;
    credits: number;
  };

  type FeedbackState = {
    tone: "success" | "error";
    message: string;
  };

  let session = $derived($authSession);
  let sections = $state<StudentSection[]>([]);
  let myEnrollments = $state<StudentEnrollmentView[]>([]);
  let profile = $state<StudentCoursesResponse["student"] | null>(null);
  let feedback = $state<FeedbackState | null>(null);
  let isLoading = $state(false);

  let bootstrappedUserId: string | null = null;

  function getCourseCredits(course: CourseCatalogEntry) {
    return course.lecCredits + course.labCredits;
  }

  function formatSchedule(items: SectionScheduleEntry[]) {
    if (items.length === 0) {
      return "TBA";
    }

    return items
      .map((item) => `${item.day} ${item.time} · ${item.type}`)
      .join(" | ");
  }

  function toErrorMessage(value: unknown) {
    if (value instanceof Error) {
      return value.message;
    }

    return "Unable to update your schedule.";
  }

  function toStatusLabel(status: string) {
    if (status === "ongoing") {
      return "In Progress";
    }

    if (status === "finalized") {
      return "Completed";
    }

    if (status === "requested") {
      return "Pending Approval";
    }

    if (status === "denied") {
      return "Denied";
    }

    return status;
  }

  function toStatusTone(status: string) {
    if (status === "finalized") {
      return "completed";
    }

    if (status === "ongoing") {
      return "in-progress";
    }

    if (status === "requested") {
      return "pending";
    }

    if (status === "denied") {
      return "denied";
    }

    return "default";
  }

  function hasFinalGrade(status: string) {
    return status === "finalized";
  }

  async function loadDashboard(studentId: string) {
    isLoading = true;
    feedback = null;

    try {
      const [sectionResponse, courseResponse, studentCoursesResponse] =
        await Promise.all([
          getSections(),
          getCourses(),
          getStudentCourses(studentId),
        ]);

      const creditsByCourseCode = new Map(
        (courseResponse ?? []).map((course) => [
          course.code,
          getCourseCredits(course),
        ]),
      );

      const sectionRows = (sectionResponse.sections ?? []).map((section) => ({
        ...section,
        credits:
          creditsByCourseCode.get(section.courseCode) ??
          creditsByCourseCode.get(section.courseId) ??
          0,
      }));

      const enrollmentSections = (studentCoursesResponse.enrollments ?? []).map(
        (enrollment) => {
          const matchingSection = sectionRows.find(
            (section) => section.id === enrollment.sectionId,
          );

          const courseCode =
            matchingSection?.courseCode ??
            enrollment.course?.code ??
            enrollment.courseCode;
          const courseTitle =
            matchingSection?.courseTitle ??
            enrollment.course?.title ??
            enrollment.courseCode;
          const sectionName =
            matchingSection?.sectionName ?? "Unassigned section";
          const instructorName = matchingSection?.instructorName ?? "TBA";
          const scheduleArray =
            matchingSection?.scheduleArray ?? enrollment.scheduleArray ?? [];
          const credits =
            matchingSection?.credits ??
            creditsByCourseCode.get(courseCode) ??
            creditsByCourseCode.get(enrollment.courseCode) ??
            0;

          return {
            id: enrollment.id,
            courseCode,
            courseTitle,
            sectionName,
            instructorName,
            scheduleArray,
            status: enrollment.status,
            grade: enrollment.grade ?? null,
            remark: enrollment.remark ?? null,
            credits,
          } satisfies StudentEnrollmentView;
        },
      );

      sections = sectionRows;
      profile = studentCoursesResponse.student ?? null;
      myEnrollments = enrollmentSections;
    } catch (error) {
      feedback = {
        tone: "error",
        message: toErrorMessage(error),
      };
    } finally {
      isLoading = false;
    }
  }

  async function handleEnroll(sectionId: string) {
    if (isLoading) {
      return;
    }

    const targetSection = sections.find((section) => section.id === sectionId);

    if (!targetSection) {
      feedback = {
        tone: "error",
        message: "Section not found.",
      };
      return;
    }

    const confirmed = confirm(
      "Are you sure you want to register for this class section?",
    );

    if (!confirmed) {
      return;
    }

    isLoading = true;
    feedback = null;

    try {
      const response = await client.api.enrollments.$post({
        json: { sectionId },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: unknown;
          message?: unknown;
        } | null;

        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : typeof payload?.message === "string"
              ? payload.message
              : `Request failed with status ${response.status}`,
        );
      }

      sections = sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              enrolledCount: section.enrolledCount + 1,
              remainingSeats: Math.max(section.remainingSeats - 1, 0),
            }
          : section,
      );

      const refreshed = await getStudentCourses(session.user.id);
      const creditsByCourseCode = new Map(
        (await getCourses()).map((course) => [
          course.code,
          getCourseCredits(course),
        ]),
      );

      profile = refreshed.student ?? null;

      myEnrollments = (refreshed.enrollments ?? []).map((enrollment) => {
        const matchingSection = sections.find(
          (section) => section.id === enrollment.sectionId,
        );

        const courseCode =
          matchingSection?.courseCode ??
          enrollment.course?.code ??
          enrollment.courseCode;
        const courseTitle =
          matchingSection?.courseTitle ??
          enrollment.course?.title ??
          enrollment.courseCode;

        return {
          id: enrollment.id,
          courseCode,
          courseTitle,
          sectionName: matchingSection?.sectionName ?? "Unassigned section",
          instructorName: matchingSection?.instructorName ?? "TBA",
          scheduleArray:
            matchingSection?.scheduleArray ?? enrollment.scheduleArray ?? [],
          status: enrollment.status,
          grade: enrollment.grade ?? null,
          remark: enrollment.remark ?? null,
          credits:
            matchingSection?.credits ??
            creditsByCourseCode.get(courseCode) ??
            creditsByCourseCode.get(enrollment.courseCode) ??
            0,
        } satisfies StudentEnrollmentView;
      });

      feedback = {
        tone: "success",
        message: `Registration request submitted for ${targetSection.courseCode} ${targetSection.sectionName}. Pending admin approval.`,
      };
    } catch (error) {
      feedback = {
        tone: "error",
        message: toErrorMessage(error),
      };
    } finally {
      isLoading = false;
    }
  }

  let totalCredits = $derived(
    myEnrollments
      .filter(
        (enrollment) =>
          enrollment.status === "ongoing" || enrollment.status === "requested",
      )
      .reduce((sum, enrollment) => sum + enrollment.credits, 0),
  );

  $effect(() => {
    if (!browser) {
      return;
    }

    const currentSession = session;

    if (!currentSession || currentSession.user.role !== "student") {
      void goto(resolve("/login"));
      return;
    }

    if (bootstrappedUserId === currentSession.user.id) {
      return;
    }

    bootstrappedUserId = currentSession.user.id;
    void loadDashboard(currentSession.user.id);
  });
</script>

<svelte:head>
  <title>Student Enrollment Cart</title>
  <meta
    name="description"
    content="Student dashboard for browsing sections and building a live enrollment schedule."
  />
</svelte:head>

<section class="student-dashboard">
  <header class="hero">
    <div>
      <p class="eyebrow">Milestone 4</p>
      <h1>Enrollments</h1>
      <p class="lede">
        Browse live class offerings on the left, then stack your active schedule
        on the right.
      </p>
    </div>

    <div class="credits-card" aria-label="Current credit total">
      <span class="credits-value">{totalCredits}</span>
      <span class="credits-label">Total enrolled credits</span>
    </div>
  </header>

  <section class="profile-card" aria-label="Student profile">
    <div>
      <p class="eyebrow">Student Profile</p>
      <h2>{session?.user.name ?? profile?.name ?? "Student"}</h2>
      <p class="profile-subcopy">
        Academic Student ID: <strong
          >{profile?.username ?? session?.user.id ?? "N/A"}</strong
        >
      </p>
    </div>
    <span class="profile-badge">Status: Active Student</span>
  </section>

  {#if feedback}
    <div
      class="banner"
      data-tone={feedback.tone}
      role="status"
      aria-live="polite"
    >
      {feedback.message}
    </div>
  {/if}

  <div class="space-y-6 w-full">
    <section class="panel offerings-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Available Class Offerings</p>
          <h2>Live sections</h2>
        </div>
        <span class="panel-chip">{sections.length} offerings</span>
      </div>

      <div
        class="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm"
      >
        <table
          class="w-full min-w-[600px] border-collapse text-left text-sm text-slate-500"
        >
          <thead>
            <tr>
              <th scope="col" class="whitespace-nowrap">Course</th>
              <th scope="col" class="whitespace-nowrap">Instructor</th>
              <th scope="col" class="whitespace-nowrap">Schedule</th>
              <th scope="col" class="whitespace-nowrap">Seats</th>
              <th scope="col" class="whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {#each sections as section (section.id)}
              <tr>
                <td class="whitespace-nowrap">
                  <div class="course-block">
                    <strong class="whitespace-nowrap"
                      >{section.courseCode}</strong
                    >
                    <span class="max-w-[200px] truncate"
                      >{section.courseTitle}</span
                    >
                    <small>{section.sectionName}</small>
                  </div>
                </td>
                <td class="whitespace-nowrap">{section.instructorName}</td>
                <td>
                  <div class="schedule-list">
                    {#each section.scheduleArray as scheduleItem, index (index)}
                      <span>{formatSchedule([scheduleItem])}</span>
                    {/each}
                    {#if section.scheduleArray.length === 0}
                      <span>TBA</span>
                    {/if}
                  </div>
                </td>
                <td class="whitespace-nowrap">
                  <span class="seat-pill">
                    {section.remainingSeats} / {section.capacity}
                  </span>
                </td>
                <td class="whitespace-nowrap">
                  <button
                    type="button"
                    class="enroll-button"
                    onclick={() => handleEnroll(section.id)}
                    disabled={isLoading || section.remainingSeats <= 0}
                  >
                    {#if section.remainingSeats <= 0}
                      Full
                    {:else if isLoading}
                      Enrolling…
                    {:else}
                      Enroll
                    {/if}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel schedule-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Classes</p>
          <h2>Enrollments</h2>
        </div>
        <span class="panel-chip">{myEnrollments.length} records</span>
      </div>

      {#if myEnrollments.length === 0}
        <div class="empty-state">
          <h3>No active enrollments</h3>
          <p>Select a section from the left to start building your schedule.</p>
        </div>
      {:else}
        <div
          class="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm"
        >
          <table
            class="w-full min-w-[600px] border-collapse text-left text-sm text-slate-500"
          >
            <thead>
              <tr>
                <th scope="col" class="whitespace-nowrap">Course</th>
                <th scope="col" class="whitespace-nowrap">Section</th>
                <th scope="col" class="whitespace-nowrap">Status</th>
                <th scope="col" class="whitespace-nowrap">Final Grade</th>
              </tr>
            </thead>
            <tbody>
              {#each myEnrollments as enrollment (enrollment.id)}
                <tr>
                  <td class="whitespace-nowrap">
                    <div class="course-block">
                      <strong class="whitespace-nowrap"
                        >{enrollment.courseCode}</strong
                      >
                      <span class="max-w-[200px] truncate"
                        >{enrollment.courseTitle}</span
                      >
                    </div>
                  </td>
                  <td>
                    <div>
                      {enrollment.sectionName} · {enrollment.instructorName}
                    </div>
                    <div class="schedule-list compact">
                      {#each enrollment.scheduleArray as scheduleItem, index (index)}
                        <span>{formatSchedule([scheduleItem])}</span>
                      {/each}
                      {#if enrollment.scheduleArray.length === 0}
                        <span>TBA</span>
                      {/if}
                    </div>
                  </td>
                  <td class="whitespace-nowrap">
                    <span
                      class="status-pill"
                      data-tone={toStatusTone(enrollment.status)}
                    >
                      {toStatusLabel(enrollment.status)}
                    </span>
                  </td>
                  <td class="whitespace-nowrap">
                    {#if hasFinalGrade(enrollment.status)}
                      <div class="grade-cell finalized-grade">
                        <span class="grade-value"
                          >{enrollment.grade ?? "-"}</span
                        >
                        <span class="grade-remark"
                          >{enrollment.remark ?? "No remark"}</span
                        >
                      </div>
                    {:else}
                      <span class="grade-value">-</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </div>
</section>

<style>
  :global(body) {
    margin: 0;
    background:
      radial-gradient(
        circle at top left,
        rgba(255, 205, 110, 0.18),
        transparent 28%
      ),
      radial-gradient(
        circle at top right,
        rgba(85, 145, 255, 0.12),
        transparent 24%
      ),
      linear-gradient(180deg, #f6f2ea 0%, #eef3f8 100%);
    color: #142033;
  }

  .student-dashboard {
    min-height: 100vh;
    padding: 2rem;
    display: grid;
    gap: 1.25rem;
  }

  .hero,
  .panel,
  .banner,
  .profile-card {
    border: 1px solid rgba(20, 32, 51, 0.12);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(16px);
    box-shadow: 0 18px 48px rgba(20, 32, 51, 0.08);
  }

  .hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.5rem 1.75rem;
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    font-size: 0.76rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #6a6f7b;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  .lede {
    max-width: 52ch;
    margin-top: 0.5rem;
    color: #516074;
    line-height: 1.55;
  }

  .credits-card {
    min-width: 180px;
    padding: 1rem 1.1rem;
    border-radius: 18px;
    background: linear-gradient(145deg, #20314f, #405c8c);
    color: #fff;
    display: grid;
    gap: 0.2rem;
    text-align: right;
  }

  .credits-value {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
  }

  .credits-label,
  .panel-chip,
  .seat-pill,
  .status-pill {
    font-size: 0.82rem;
  }

  .profile-card {
    padding: 1rem 1.2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .profile-subcopy {
    margin-top: 0.35rem;
    color: #516074;
  }

  .profile-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.45rem 0.8rem;
    background: rgba(28, 136, 82, 0.12);
    border: 1px solid rgba(28, 136, 82, 0.22);
    color: #18613d;
    font-weight: 700;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .banner {
    padding: 0.95rem 1.1rem;
    font-weight: 600;
  }

  .banner[data-tone="success"] {
    border-color: rgba(28, 136, 82, 0.22);
    background: rgba(233, 248, 239, 0.94);
    color: #18613d;
  }

  .banner[data-tone="error"] {
    border-color: rgba(197, 63, 63, 0.22);
    background: rgba(255, 239, 239, 0.95);
    color: #9f2d2d;
  }

  .panel {
    padding: 1.25rem;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .panel-chip,
  .seat-pill,
  .status-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    background: rgba(20, 32, 51, 0.08);
    color: #304057;
    font-weight: 600;
  }

  .status-pill[data-tone="in-progress"] {
    background: rgba(20, 32, 51, 0.08);
    color: #304057;
  }

  .status-pill[data-tone="completed"] {
    background: rgba(28, 136, 82, 0.12);
    border: 1px solid rgba(28, 136, 82, 0.22);
    color: #18613d;
  }

  .status-pill[data-tone="pending"] {
    background: rgba(255, 205, 110, 0.12);
    border: 1px solid rgba(255, 205, 110, 0.22);
    color: #8c6d1f;
  }

  .status-pill[data-tone="denied"] {
    background: rgba(197, 63, 63, 0.12);
    border: 1px solid rgba(197, 63, 63, 0.22);
    color: #9f2d2d;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  th,
  td {
    padding: 0.95rem 1rem;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid rgba(20, 32, 51, 0.08);
  }

  th {
    background: rgba(20, 32, 51, 0.03);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5a6474;
  }

  .course-block {
    display: grid;
    gap: 0.2rem;
  }

  .course-block span,
  .course-block small,
  .empty-state p {
    color: #516074;
  }

  .course-block strong {
    font-size: 0.98rem;
  }

  .schedule-list {
    display: grid;
    gap: 0.3rem;
    color: #38475f;
  }

  .schedule-list.compact {
    margin-top: 0.7rem;
  }

  .grade-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .grade-value {
    font-weight: 700;
    color: #223247;
  }

  .grade-remark {
    color: #516074;
    font-size: 0.86rem;
  }

  .finalized-grade .grade-value {
    color: #18613d;
  }

  .enroll-button {
    min-width: 96px;
    padding: 0.7rem 0.95rem;
    border: 0;
    border-radius: 14px;
    background: linear-gradient(135deg, #304057, #5873a4);
    color: white;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 140ms ease,
      opacity 140ms ease,
      box-shadow 140ms ease;
  }

  .enroll-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(48, 64, 87, 0.22);
  }

  .enroll-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .schedule-panel {
    display: grid;
    gap: 0.95rem;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: #516074;
  }

  .empty-state h3 {
    margin-bottom: 0.45rem;
    color: #243347;
  }

  @media (max-width: 1080px) {
    .hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .profile-card {
      align-items: flex-start;
      flex-direction: column;
    }

    .credits-card {
      text-align: left;
      min-width: 0;
      width: 100%;
    }
  }

  @media (max-width: 720px) {
    .student-dashboard {
      padding: 1rem;
    }

    .panel {
      padding: 1rem;
    }

    .hero {
      padding: 1.15rem;
    }
  }
</style>
