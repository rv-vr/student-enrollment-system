<script lang="ts">
  import { authSession } from "$lib/stores/auth";
  import { dropStudentCourse, getStudentCourses } from "$lib/api/client";
  import type { StudentCoursesResponse } from "$lib/api/types";
  import { onMount } from "svelte";

  let studentCourses = $state<StudentCoursesResponse | null>(null);
  let loading = $state(true);
  let actionCourseCode = $state<string | null>(null);
  let alertMessage = $state("");
  let alertTone = $state<"error" | "success" | "">("");
  let session = $derived($authSession);

  function showAlert(message: string, tone: "error" | "success") {
    alertMessage = message;
    alertTone = tone;
  }

  async function refreshStudentCourses(studentId: string) {
    loading = true;
    alertMessage = "";
    alertTone = "";

    try {
      studentCourses = await getStudentCourses(studentId);
    } catch (error) {
      studentCourses = null;
      showAlert(
        error instanceof Error ? error.message : "Unable to load your courses.",
        "error",
      );
    } finally {
      loading = false;
    }
  }

  async function handleDrop(courseCode: string) {
    if (!session) {
      showAlert("Sign in to manage your enrollments.", "error");
      return;
    }

    actionCourseCode = courseCode;
    alertMessage = "";
    alertTone = "";

    try {
      const response = await dropStudentCourse(session.user.id, courseCode);
      showAlert(response.message, "success");
      studentCourses = await getStudentCourses(session.user.id);
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Unable to drop the course.",
        "error",
      );
    } finally {
      actionCourseCode = null;
    }
  }

  onMount(() => {
    if (session) {
      void refreshStudentCourses(session.user.id);
    }
  });
</script>

<svelte:head>
  <title>My Courses</title>
</svelte:head>

<section class="page-grid">
  <div class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Student view</p>
        <h2>My enrolled courses</h2>
        <p class="helper">
          {#if session}
            Current account: <strong>{session.user.name}</strong> ({session.user
              .role})
          {:else}
            Loading authenticated account.
          {/if}
        </p>
      </div>
      <div class="meta">
        {studentCourses?.enrollments.length ?? 0} active enrollment{(studentCourses
          ?.enrollments.length ?? 0) === 1
          ? ""
          : "s"}
      </div>
    </div>

    {#if alertMessage}
      <div
        class="banner"
        data-tone={alertTone}
        role="status"
        aria-live="polite"
      >
        {alertMessage}
      </div>
    {/if}

    {#if loading}
      <div class="empty-state">
        <h2>Loading student courses</h2>
        <p>Fetching the live enrollments for the selected student.</p>
      </div>
    {:else if !studentCourses || studentCourses.enrollments.length === 0}
      <div class="empty-state">
        <h2>No active enrollments</h2>
        <p>This student is not enrolled in any courses yet.</p>
      </div>
    {:else}
      <div class="table-shell">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Title</th>
                <th scope="col">Grade</th>
                <th scope="col">Enrollment ID</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each studentCourses.enrollments as enrollment (enrollment.id)}
                <tr>
                  <td class="course-code"
                    >{enrollment.course?.code ?? enrollment.courseCode}</td
                  >
                  <td>
                    <div class="course-title">
                      {enrollment.course?.title ?? enrollment.courseCode}
                    </div>
                    {#if enrollment.course?.prerequisiteCodes?.length}
                      <p class="meta">Prerequisite path completed</p>
                    {/if}
                  </td>
                  <td>
                    <span
                      class="pill"
                      data-tone={enrollment.grade == null ? "warn" : "good"}
                    >
                      {enrollment.grade == null
                        ? "No Grade Assigned"
                        : String(enrollment.grade)}
                    </span>
                  </td>
                  <td>
                    <span class="pill" data-tone="info">{enrollment.id}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="danger-button"
                      onclick={() => handleDrop(enrollment.courseCode)}
                      disabled={actionCourseCode === enrollment.courseCode}
                    >
                      {actionCourseCode === enrollment.courseCode
                        ? "Dropping…"
                        : "Drop Course"}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</section>
