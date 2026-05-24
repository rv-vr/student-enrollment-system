<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";
  import {
    ApiError,
    createSection,
    getCourses,
    getSections,
    getUsers,
    type SectionCreatePayload,
  } from "$lib/api/client";
  import type {
    CourseCatalogEntry,
    PublicUser,
    SectionCatalogEntry,
    SectionScheduleEntry,
  } from "$lib/api/types";

  type SectionFormState = {
    courseCode: string;
    instructorId: string;
    sectionName: string;
    capacity: string;
  };

  type ScheduleDraftState = SectionScheduleEntry;

  type FeedbackState = {
    tone: "success" | "error";
    message: string;
  };

  const defaultForm = (): SectionFormState => ({
    courseCode: "",
    instructorId: "",
    sectionName: "Section A",
    capacity: "30",
  });

  const defaultScheduleDraft = (): ScheduleDraftState => ({
    day: "Monday",
    time: "08:00 - 09:30",
    type: "Lecture",
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

    return error instanceof Error ? error.message : "Unable to save section.";
  }

  function formatSchedule(items: SectionScheduleEntry[]) {
    if (items.length === 0) {
      return "No schedule";
    }

    return items.map((item) => `${item.day} ${item.time} · ${item.type}`).join(" | ");
  }

  let session = $derived($authSession);
  let form = $state<SectionFormState>(defaultForm());
  let scheduleDraft = $state<ScheduleDraftState>(defaultScheduleDraft());
  let scheduleItems = $state<SectionScheduleEntry[]>([]);
  let courses = $state<CourseCatalogEntry[]>([]);
  let instructors = $state<PublicUser[]>([]);
  let sections = $state<SectionCatalogEntry[]>([]);
  let createdSections = $state<SectionCatalogEntry[]>([]);
  let feedback = $state<FeedbackState | null>(null);
  let isLoading = $state(false);
  let isFetching = $state(true);
  let hasBooted = $state(false);

  let activeCourseOptions = $derived(courses);
  let instructorOptions = $derived(
    instructors.filter((user) => user.role === "instructor"),
  );
  let sectionCount = $derived(sections.length);
  let sessionSectionCount = $derived(createdSections.length);

  async function loadData() {
    isFetching = true;

    try {
      const [courseResponse, instructorResponse, sectionResponse] = await Promise.all([
        getCourses(),
        getUsers("instructor"),
        getSections(),
      ]);

      courses = courseResponse ?? [];
      instructors = instructorResponse.users ?? [];
      sections = sectionResponse.sections ?? [];
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
    scheduleDraft = defaultScheduleDraft();
    scheduleItems = [];
  }

  function addScheduleItem() {
    const day = scheduleDraft.day.trim();
    const time = scheduleDraft.time.trim();
    const type = scheduleDraft.type.trim();

    if (!day || !time || !type) {
      feedback = {
        tone: "error",
        message: "Day, time, and type are required for each schedule item.",
      };
      return;
    }

    scheduleItems = [
      ...scheduleItems,
      {
        day,
        time,
        type,
      },
    ];

    scheduleDraft = defaultScheduleDraft();
    feedback = null;
  }

  function removeScheduleItem(index: number) {
    scheduleItems = scheduleItems.filter((_, itemIndex) => itemIndex !== index);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    feedback = null;

    const courseCode = normalizeCode(form.courseCode);
    const sectionName = form.sectionName.trim();
    const instructorId = form.instructorId.trim();
    const capacity = Number(form.capacity);

    if (!courseCode || !sectionName || !instructorId) {
      feedback = {
        tone: "error",
        message: "Course, instructor, and section name are required.",
      };
      return;
    }

    if (!Number.isFinite(capacity) || capacity <= 0) {
      feedback = {
        tone: "error",
        message: "Capacity must be a positive number.",
      };
      return;
    }

    if (scheduleItems.length === 0) {
      feedback = {
        tone: "error",
        message: "Add at least one schedule item.",
      };
      return;
    }

    const payload: SectionCreatePayload = {
      courseCode,
      instructorId,
      sectionName,
      capacity,
      scheduleArray: scheduleItems,
    };

    isLoading = true;

    try {
      const response = await createSection(payload);
      const createdSection = response.section;

      sections = [
        createdSection,
        ...sections.filter((entry) => entry.id !== createdSection.id),
      ];
      createdSections = [createdSection, ...createdSections];
      resetForm();
      feedback = {
        tone: "success",
        message: `Created section ${createdSection.sectionName} for ${createdSection.courseCode}.`,
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
    void loadData();
  });
</script>

<svelte:head>
  <title>Admin Section Management</title>
  <meta
    name="description"
    content="Admin console for provisioning live course sections."
  />
</svelte:head>

<section class="admin-sections-page">
  <header class="hero-card">
    <div>
      <p class="eyebrow">Section-Based Architecture</p>
      <h1>Section Management</h1>
      <p class="lede">
        Assign instructors, break courses into live offerings, and control each
        section's schedule and capacity independently.
      </p>
    </div>

    <div class="hero-stats" aria-label="Section summary">
      <div>
        <span class="stat-value">{sectionCount}</span>
        <span class="stat-label">Active Sections</span>
      </div>
      <div>
        <span class="stat-value">{sessionSectionCount}</span>
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
          <p class="eyebrow">Create Section</p>
          <h2>Schedule offering</h2>
        </div>
        <span class="panel-badge">Section scheduling</span>
      </div>

      <form class="section-form" onsubmit={handleSubmit}>
        <div class="form-grid">
          <label>
            <span>Course</span>
            <select bind:value={form.courseCode} required>
              <option value="" disabled>Select a course</option>
              {#each activeCourseOptions as course (course.id)}
                <option value={course.code}>
                  {course.code} - {course.title}
                </option>
              {/each}
            </select>
          </label>

          <label>
            <span>Instructor</span>
            <select bind:value={form.instructorId} required>
              <option value="" disabled>Select an instructor</option>
              {#each instructorOptions as instructor (instructor.id)}
                <option value={instructor.id}>
                  {instructor.name} ({instructor.username})
                </option>
              {/each}
            </select>
          </label>

          <label>
            <span>Section Name</span>
            <input
              bind:value={form.sectionName}
              placeholder="Section A"
              required
            />
          </label>

          <label>
            <span>Capacity</span>
            <input
              bind:value={form.capacity}
              min="1"
              placeholder="30"
              required
              type="number"
            />
          </label>
        </div>

        <div class="schedule-block">
          <div class="block-heading">
            <div>
              <h3>Schedule Array Builder</h3>
              <p>Add day, time, and class type entries for this section.</p>
            </div>
            <span class="pill">{scheduleItems.length} items</span>
          </div>

          <div class="schedule-grid">
            <label>
              <span>Day</span>
              <input bind:value={scheduleDraft.day} placeholder="Monday" />
            </label>

            <label>
              <span>Time</span>
              <input bind:value={scheduleDraft.time} placeholder="08:00 - 09:30" />
            </label>

            <label>
              <span>Type</span>
              <input bind:value={scheduleDraft.type} placeholder="Lecture" />
            </label>

            <div class="schedule-action">
              <button type="button" class="secondary-button" onclick={addScheduleItem}>
                Add Schedule Item
              </button>
            </div>
          </div>

          {#if scheduleItems.length > 0}
            <div class="schedule-list">
              {#each scheduleItems as item, index (item.day + item.time + item.type + index)}
                <div class="schedule-card">
                  <div>
                    <strong>{item.day}</strong>
                    <p>{item.time} · {item.type}</p>
                  </div>
                  <button
                    type="button"
                    class="ghost-button"
                    onclick={() => removeScheduleItem(index)}
                  >
                    Remove
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-copy">
              No schedule items yet. Add at least one before saving.
            </div>
          {/if}
        </div>

        <div class="form-actions">
          <button type="submit" class="primary-button" disabled={isLoading}>
            {isLoading ? "Saving…" : "Create Section"}
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
          <p class="eyebrow">Live Sections</p>
          <h2>Active schedule</h2>
        </div>
        <span class="panel-badge">{isFetching ? "Refreshing" : "Live view"}</span>
      </div>

      {#if isFetching}
        <div class="empty-copy">Loading sections…</div>
      {:else if sections.length === 0}
        <div class="empty-copy">No live sections yet.</div>
      {:else}
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Section</th>
                <th scope="col">Instructor</th>
                <th scope="col">Capacity</th>
                <th scope="col">Remaining</th>
                <th scope="col">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {#each sections as section (section.id)}
                <tr>
                  <td>
                    <strong>{section.courseCode}</strong>
                    <div class="table-subcopy">{section.courseTitle}</div>
                  </td>
                  <td>{section.sectionName}</td>
                  <td>{section.instructorName}</td>
                  <td>{section.capacity}</td>
                  <td>
                    <span class="seat-chip">
                      {section.remainingSeats} / {section.capacity}
                    </span>
                  </td>
                  <td>
                    <div class="schedule-summary">{formatSchedule(section.scheduleArray)}</div>
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
  .admin-sections-page {
    min-height: 100%;
    padding: clamp(1.25rem, 2vw, 2rem);
    color: #f8fafc;
    background:
      radial-gradient(circle at top left, rgba(56, 189, 248, 0.22), transparent 38%),
      radial-gradient(circle at top right, rgba(168, 85, 247, 0.16), transparent 32%),
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
    max-width: 52rem;
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

  .section-form {
    display: grid;
    gap: 1rem;
  }

  .form-grid,
  .schedule-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  select {
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
  select:focus {
    border-color: rgba(103, 232, 249, 0.5);
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.15);
  }

  .schedule-block {
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

  .schedule-action {
    display: flex;
    align-items: end;
  }

  .schedule-list {
    display: grid;
    gap: 0.75rem;
    margin-top: 0.9rem;
  }

  .schedule-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(2, 6, 23, 0.72);
    padding: 0.85rem 0.95rem;
  }

  .schedule-card strong {
    display: block;
    color: #f8fafc;
  }

  .schedule-card p,
  .table-subcopy,
  .schedule-summary {
    color: #94a3b8;
    font-size: 0.86rem;
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
  .secondary-button,
  .ghost-button {
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

  .ghost-button {
    background: rgba(15, 23, 42, 0.72);
    border-color: rgba(148, 163, 184, 0.18);
    color: #e2e8f0;
    padding: 0.65rem 0.95rem;
  }

  .primary-button:hover,
  .secondary-button:hover,
  .ghost-button:hover {
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
    min-width: 52rem;
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
    .schedule-grid {
      grid-template-columns: 1fr;
    }

    .panel-heading,
    .block-heading,
    .form-actions,
    .schedule-card {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
