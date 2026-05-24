<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";
  import {
    ApiError,
    createAdminCourse,
    getCourses,
    type AdminCourseCreatePayload,
  } from "$lib/api/client";
  import type { CourseCatalogEntry } from "$lib/api/types";

  type CourseFormState = {
    id: string;
    title: string;
    description: string;
    capacity: string;
    labCredits: string;
    lecCredits: string;
    prerequisites: string[];
  };

  type FeedbackState = {
    tone: "success" | "error";
    message: string;
  };

  const defaultForm = (): CourseFormState => ({
    id: "",
    title: "",
    description: "",
    capacity: "30",
    labCredits: "1",
    lecCredits: "3",
    prerequisites: [],
  });

  function normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  function toPublicError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return "Unauthorized access.";
      }

      if (typeof error.payload === "object" && error.payload) {
        const payload = error.payload as { error?: unknown };

        if (typeof payload.error === "string" && payload.error.trim()) {
          return payload.error;
        }
      }
    }

    return error instanceof Error ? error.message : "Unable to save course.";
  }

  function formatCredits(course: CourseCatalogEntry) {
    return `${course.lecCredits} lec / ${course.labCredits} lab`;
  }

  function formatPrerequisites(course: CourseCatalogEntry) {
    return course.prerequisites.length > 0
      ? course.prerequisites.join(", ")
      : "None";
  }

  let session = $derived($authSession);
  let form = $state<CourseFormState>(defaultForm());
  let courses = $state<CourseCatalogEntry[]>([]);
  let createdCourses = $state<CourseCatalogEntry[]>([]);
  let feedback = $state<FeedbackState | null>(null);
  let isLoading = $state(false);
  let isFetching = $state(true);
  let hasBooted = $state(false);

  let prerequisiteOptions = $derived(
    courses.filter(
      (course) => normalizeCode(course.code) !== normalizeCode(form.id),
    ),
  );
  let courseCount = $derived(courses.length);
  let recentCount = $derived(createdCourses.length);

  async function loadCourses() {
    isFetching = true;

    try {
      const response = await getCourses();
      courses = response ?? [];
    } catch (error) {
      feedback = {
        tone: "error",
        message: toPublicError(error),
      };
    } finally {
      isFetching = false;
    }
  }

  function resetForm() {
    form = defaultForm();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    feedback = null;

    const id = normalizeCode(form.id);
    const title = form.title.trim();
    const capacity = Number(form.capacity);
    const labCredits = Number(form.labCredits);
    const lecCredits = Number(form.lecCredits);

    if (!id || !title) {
      feedback = {
        tone: "error",
        message: "Course code and title are required.",
      };
      return;
    }

    if (
      !Number.isFinite(capacity) ||
      !Number.isFinite(labCredits) ||
      !Number.isFinite(lecCredits)
    ) {
      feedback = {
        tone: "error",
        message: "Capacity and credits must be valid numbers.",
      };
      return;
    }

    const payload: AdminCourseCreatePayload = {
      id,
      title,
      description: form.description.trim() || undefined,
      capacity,
      labCredits,
      lecCredits,
      prerequisites: form.prerequisites,
    };

    isLoading = true;

    try {
      const response = await createAdminCourse(payload);
      const createdCourse = response.course;

      courses = [
        createdCourse,
        ...courses.filter(
          (course) => normalizeCode(course.code) !== normalizeCode(createdCourse.code),
        ),
      ];
      createdCourses = [createdCourse, ...createdCourses];
      resetForm();
      feedback = {
        tone: "success",
        message: `Created course ${createdCourse.code}.`,
      };
    } catch (error) {
      feedback = {
        tone: "error",
        message: toPublicError(error),
      };
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (!browser || hasBooted) {
      return;
    }

    if (!session) {
      hasBooted = true;
      void goto(resolve("/login"));
      return;
    }

    if (session.user.role !== "admin") {
      hasBooted = true;
      void goto(resolve("/login"));
      return;
    }

    hasBooted = true;
    void loadCourses();
  });
</script>

<svelte:head>
  <title>Admin Course Catalog</title>
  <meta
    name="description"
    content="Admin course registration and catalog management dashboard."
  />
</svelte:head>

<section class="admin-courses-page">
  <header class="hero-card">
    <div>
      <p class="eyebrow">Milestone 4</p>
      <h1>Course Catalog Control</h1>
      <p class="lede">
        Register new courses, assign prerequisite chains, and keep the live
        catalog current.
      </p>
    </div>

    <div class="hero-stats" aria-label="Catalog summary">
      <div>
        <span class="stat-value">{courseCount}</span>
        <span class="stat-label">Active Courses</span>
      </div>
      <div>
        <span class="stat-value">{recentCount}</span>
        <span class="stat-label">Created This Session</span>
      </div>
    </div>
  </header>

  {#if feedback}
    <div class="feedback" data-tone={feedback.tone} role="alert">
      {feedback.message}
    </div>
  {/if}

  <div class="admin-grid">
    <section class="panel form-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Create New Course</p>
          <h2>Register course</h2>
        </div>
        <span class="panel-badge">DB-backed insert</span>
      </div>

      <form class="course-form" onsubmit={handleSubmit}>
        <div class="form-grid">
          <label>
            <span>Course Code</span>
            <input
              bind:value={form.id}
              autocomplete="off"
              placeholder="CS101"
              required
            />
          </label>

          <label>
            <span>Title</span>
            <input
              bind:value={form.title}
              autocomplete="off"
              placeholder="Introduction to Computing"
              required
            />
          </label>

          <label>
            <span>Capacity</span>
            <input
              bind:value={form.capacity}
              inputmode="numeric"
              min="1"
              placeholder="30"
              required
              type="number"
            />
          </label>

          <label>
            <span>Lecture Credits</span>
            <input
              bind:value={form.lecCredits}
              inputmode="decimal"
              min="0"
              step="0.5"
              placeholder="3"
              required
              type="number"
            />
          </label>

          <label>
            <span>Lab Credits</span>
            <input
              bind:value={form.labCredits}
              inputmode="decimal"
              min="0"
              step="0.5"
              placeholder="1"
              required
              type="number"
            />
          </label>

          <label class="span-2">
            <span>Description</span>
            <textarea
              bind:value={form.description}
              placeholder="Short catalog description"
              rows="4"
            ></textarea>
          </label>
        </div>

        <div class="prereq-block">
          <div class="block-heading">
            <div>
              <h3>Prerequisite Selector</h3>
              <p>Pick existing courses that must be completed first.</p>
            </div>
            <span class="pill">{form.prerequisites.length} selected</span>
          </div>

          {#if prerequisiteOptions.length > 0}
            <div class="checkbox-grid" role="group" aria-label="Prerequisites">
              {#each prerequisiteOptions as course (course.id)}
                <label class="checkbox-card">
                  <input
                    bind:group={form.prerequisites}
                    type="checkbox"
                    value={course.code}
                  />
                  <span>
                    <strong>{course.code}</strong>
                    <small>{course.title}</small>
                  </span>
                </label>
              {/each}
            </div>
          {:else}
            <div class="empty-copy">
              Add at least one course before chaining prerequisites.
            </div>
          {/if}
        </div>

        <div class="form-actions">
          <button type="submit" class="primary-button" disabled={isLoading}>
            {isLoading ? "Saving…" : "Create Course"}
          </button>
          <button type="button" class="secondary-button" onclick={resetForm}>
            Reset Form
          </button>
        </div>
      </form>
    </section>

    <section class="panel catalog-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Catalog Snapshot</p>
          <h2>Active catalog</h2>
        </div>
        <span class="panel-badge">{isFetching ? "Refreshing" : "Live view"}</span>
      </div>

      {#if isFetching}
        <div class="empty-copy">Loading course catalog…</div>
      {:else if courses.length === 0}
        <div class="empty-copy">No courses registered yet.</div>
      {:else}
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Title</th>
                <th scope="col">Credits</th>
                <th scope="col">Remaining Seats / Capacity</th>
                <th scope="col">Prerequisites</th>
              </tr>
            </thead>
            <tbody>
              {#each courses as course (course.id)}
                <tr>
                  <td>
                    <strong>{course.code}</strong>
                  </td>
                  <td>
                    <div class="course-title">{course.title}</div>
                    {#if course.description}
                      <div class="course-description">{course.description}</div>
                    {/if}
                  </td>
                  <td>{formatCredits(course)}</td>
                  <td>
                    <span class="seat-chip">
                      {course.remainingSeats} / {course.capacity}
                    </span>
                  </td>
                  <td>{formatPrerequisites(course)}</td>
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
  .admin-courses-page {
    min-height: 100%;
    padding: clamp(1.25rem, 2vw, 2rem);
    color: #f8fafc;
    background:
      radial-gradient(circle at top left, rgba(14, 165, 233, 0.24), transparent 38%),
      radial-gradient(circle at top right, rgba(234, 179, 8, 0.16), transparent 32%),
      linear-gradient(180deg, #020617 0%, #0f172a 100%);
  }

  .hero-card,
  .panel {
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.78);
    backdrop-filter: blur(18px);
    box-shadow: 0 24px 70px rgba(2, 6, 23, 0.35);
  }

  .hero-card {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    border-radius: 1.5rem;
    padding: 1.5rem;
  }

  .eyebrow {
    margin: 0 0 0.4rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: #67e8f9;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    font-size: clamp(2rem, 4vw, 3.3rem);
    line-height: 1.02;
    margin-bottom: 0.65rem;
  }

  .lede {
    max-width: 50rem;
    color: #cbd5e1;
    line-height: 1.6;
  }

  .hero-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
    min-width: min(100%, 19rem);
  }

  .hero-stats > div {
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 1rem;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.68);
  }

  .stat-value {
    display: block;
    font-size: 1.7rem;
    font-weight: 800;
    color: #fff;
  }

  .stat-label {
    display: block;
    margin-top: 0.25rem;
    color: #94a3b8;
    font-size: 0.82rem;
  }

  .feedback {
    margin-top: 1rem;
    border-radius: 1rem;
    padding: 0.9rem 1rem;
    border: 1px solid transparent;
  }

  .feedback[data-tone="success"] {
    border-color: rgba(74, 222, 128, 0.3);
    background: rgba(20, 83, 45, 0.55);
    color: #bbf7d0;
  }

  .feedback[data-tone="error"] {
    border-color: rgba(251, 113, 133, 0.28);
    background: rgba(127, 29, 29, 0.5);
    color: #fecdd3;
  }

  .admin-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 1.18fr);
    margin-top: 1rem;
  }

  .panel {
    border-radius: 1.5rem;
    padding: 1.25rem;
  }

  .panel-heading,
  .block-heading,
  .form-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .panel-heading {
    margin-bottom: 1rem;
  }

  .panel-heading h2 {
    font-size: 1.4rem;
  }

  .panel-badge,
  .pill,
  .seat-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    padding: 0.45rem 0.8rem;
    background: rgba(15, 23, 42, 0.7);
    color: #cbd5e1;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .course-form {
    display: grid;
    gap: 1rem;
  }

  .form-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .span-2 {
    grid-column: span 2;
  }

  label {
    display: grid;
    gap: 0.4rem;
  }

  label span {
    font-size: 0.86rem;
    color: #cbd5e1;
  }

  input,
  textarea {
    width: 100%;
    border-radius: 0.95rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.92);
    color: #f8fafc;
    padding: 0.9rem 1rem;
    font: inherit;
    outline: none;
  }

  input:focus,
  textarea:focus {
    border-color: rgba(103, 232, 249, 0.5);
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.15);
  }

  textarea {
    resize: vertical;
  }

  .prereq-block {
    border-radius: 1.25rem;
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: rgba(15, 23, 42, 0.55);
    padding: 1rem;
  }

  .block-heading {
    align-items: flex-start;
    margin-bottom: 0.9rem;
  }

  .block-heading h3 {
    margin-bottom: 0.25rem;
  }

  .block-heading p {
    color: #94a3b8;
    font-size: 0.86rem;
  }

  .checkbox-grid {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }

  .checkbox-card {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(2, 6, 23, 0.72);
    padding: 0.85rem 0.9rem;
  }

  .checkbox-card strong {
    display: block;
    color: #f8fafc;
  }

  .checkbox-card small {
    display: block;
    margin-top: 0.1rem;
    color: #94a3b8;
  }

  .empty-copy {
    border-radius: 1rem;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.6);
    color: #94a3b8;
  }

  .form-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .primary-button,
  .secondary-button {
    border-radius: 0.95rem;
    border: 1px solid transparent;
    padding: 0.85rem 1.1rem;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 140ms ease,
      border-color 140ms ease,
      background 140ms ease;
  }

  .primary-button {
    background: linear-gradient(135deg, #22d3ee, #38bdf8);
    color: #02111f;
  }

  .secondary-button {
    background: rgba(15, 23, 42, 0.72);
    border-color: rgba(148, 163, 184, 0.18);
    color: #e2e8f0;
  }

  .primary-button:hover,
  .secondary-button:hover {
    transform: translateY(-1px);
  }

  .primary-button:disabled {
    cursor: wait;
    opacity: 0.72;
    transform: none;
  }

  .table-shell {
    overflow-x: auto;
    border-radius: 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.15);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 48rem;
  }

  thead {
    background: rgba(15, 23, 42, 0.85);
    color: #cbd5e1;
  }

  th,
  td {
    padding: 0.95rem 1rem;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  }

  tbody tr:hover {
    background: rgba(15, 23, 42, 0.5);
  }

  .course-title {
    color: #f8fafc;
    font-weight: 700;
  }

  .course-description {
    margin-top: 0.25rem;
    color: #94a3b8;
    font-size: 0.86rem;
  }

  .seat-chip {
    color: #dbeafe;
  }

  @media (max-width: 980px) {
    .hero-card,
    .admin-grid {
      grid-template-columns: 1fr;
      flex-direction: column;
    }

    .hero-stats {
      min-width: 0;
    }
  }

  @media (max-width: 720px) {
    .form-grid,
    .checkbox-grid {
      grid-template-columns: 1fr;
    }

    .span-2 {
      grid-column: span 1;
    }

    .panel-heading,
    .block-heading,
    .form-actions {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>