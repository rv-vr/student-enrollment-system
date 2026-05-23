<script lang="ts">
  import { onMount } from "svelte";
  import { authSession } from "$lib/stores/auth";
  import {
    dropStudentCourse,
    getStudentCourses,
    getStudentNotifications,
    type StudentCoursesResponse,
    type StudentNotificationsResponse,
  } from "$lib/api/client";
  import { derived, get, writable } from "svelte/store";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const session = derived(authSession, ($s) => $s);

  const studentCourses = writable<StudentCoursesResponse | null>(null);
  const notifications = writable<StudentNotificationsResponse["notifications"]>(
    [],
  );
  const loading = writable(true);
  const loadingNotifications = writable(true);
  const actionCourseCode = writable<string | null>(null);
  const alertMessage = writable("");
  const alertTone = writable<"error" | "success" | "">("");

  function showAlert(message: string, tone: "error" | "success") {
    alertMessage.set(message);
    alertTone.set(tone);
  }

  async function refreshStudentCourses(studentId: string) {
    loading.set(true);
    alertMessage.set("");
    alertTone.set("");

    try {
      studentCourses.set(await getStudentCourses(studentId));
    } catch (error) {
      studentCourses.set(null);
      showAlert(
        error instanceof Error ? error.message : "Unable to load your courses.",
        "error",
      );
    } finally {
      loading.set(false);
    }
  }

  async function refreshNotifications(studentId: string) {
    loadingNotifications.set(true);

    try {
      const res = await getStudentNotifications(studentId);
      notifications.set(res.notifications ?? []);
    } catch (error) {
      notifications.set([]);
      showAlert(
        error instanceof Error
          ? error.message
          : "Unable to load notifications.",
        "error",
      );
    } finally {
      loadingNotifications.set(false);
    }
  }

  async function handleDrop(courseCode: string) {
    const currentSession = get(session);

    if (!currentSession) {
      showAlert("Sign in to manage your enrollments.", "error");
      return;
    }

    actionCourseCode.set(courseCode);
    alertMessage.set("");
    alertTone.set("");

    try {
      const response = await dropStudentCourse(
        currentSession.user.id,
        courseCode,
      );
      showAlert(response.message, "success");
      studentCourses.set(await getStudentCourses(currentSession.user.id));
      await refreshNotifications(currentSession.user.id);
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Unable to drop the course.",
        "error",
      );
    } finally {
      actionCourseCode.set(null);
    }
  }

  onMount(() => {
    const currentSession = get(session);

    if (!currentSession) {
      void goto(resolve("/login"));
      return;
    }

    if (currentSession.user.role !== "student") {
      const target =
        currentSession.user.role === "instructor" ? "/instructor" : "/admin";
      void goto(resolve(target));
      return;
    }

    void refreshStudentCourses(currentSession.user.id);
    void refreshNotifications(currentSession.user.id);
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
          {#if $session}
            Current account: <strong>{$session.user.name}</strong> ({$session
              .user.role})
          {:else}
            Loading authenticated account.
          {/if}
        </p>
      </div>
      <div class="meta">
        {$studentCourses?.enrollments.length ?? 0} active enrollment{($studentCourses
          ?.enrollments.length ?? 0) === 1
          ? ""
          : "s"}
      </div>
    </div>

    {#if $alertMessage}
      <div
        class="banner"
        data-tone={$alertTone}
        role="status"
        aria-live="polite"
      >
        {$alertMessage}
      </div>
    {/if}

    {#if $loading}
      <div class="empty-state">
        <h2>Loading student courses</h2>
        <p>Fetching the live enrollments for the selected student.</p>
      </div>
    {:else if !$studentCourses || $studentCourses.enrollments.length === 0}
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
              {#each $studentCourses.enrollments as enrollment (enrollment.id)}
                <tr>
                  <td class="course-code"
                    >{enrollment.course?.code ?? enrollment.courseCode}</td
                  >
                  <td>
                    <div class="course-title">
                      {enrollment.course?.title ?? enrollment.courseCode}
                    </div>
                    <div class="mt-1">
                      <span
                        class="inline-flex rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide"
                        class:border-amber-300={enrollment.status === "pending"}
                        class:bg-amber-100={enrollment.status === "pending"}
                        class:text-amber-900={enrollment.status === "pending"}
                        class:border-emerald-300={enrollment.status ===
                          "approved"}
                        class:bg-emerald-100={enrollment.status === "approved"}
                        class:text-emerald-900={enrollment.status ===
                          "approved"}
                      >
                        {enrollment.status}
                      </span>
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
                      disabled={$actionCourseCode === enrollment.courseCode}
                    >
                      {$actionCourseCode === enrollment.courseCode
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
