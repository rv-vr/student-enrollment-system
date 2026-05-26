<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";
  import {
    ApiError,
    createSection,
    getAdminSectionRoster,
    getCourses,
    getSections,
    getUsers,
    getAdminRequests,
    approveAdminEnrollment,
    denyAdminEnrollment,
    type SectionCreatePayload,
    type AdminRequestsResponse,
  } from "$lib/api/client";
  import type {
    AdminRosterEntry,
    CourseCatalogEntry,
    PublicUser,
    SectionCatalogEntry,
    SectionScheduleEntry,
  } from "$lib/api/types";
  import {
    Card,
    Table,
    TableHead,
    TableHeadCell,
    TableBody,
    TableBodyRow,
    TableBodyCell,
    Badge,
    Heading,
    P,
    Label,
    Input,
    Select,
    Button,
    Alert,
  } from "flowbite-svelte";

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

    return items
      .map((item) => `${item.day} ${item.time} · ${item.type}`)
      .join(" | ");
  }

  async function viewRoster(section: SectionCatalogEntry) {
    rosterSection = section;
    rosterLoading = true;
    feedback = null;

    try {
      roster = await getAdminSectionRoster(section.id);
    } catch (error) {
      roster = [];
      feedback = {
        tone: "error",
        message: toPublicError(error),
      };
    } finally {
      rosterLoading = false;
    }
  }

  function isFinalized(row: AdminRosterEntry) {
    return row.status === "finalized";
  }

  let session = $derived($authSession);
  let form = $state<SectionFormState>(defaultForm());
  let scheduleDraft = $state<ScheduleDraftState>(defaultScheduleDraft());
  let scheduleItems = $state<SectionScheduleEntry[]>([]);
  let courses = $state<CourseCatalogEntry[]>([]);
  let instructors = $state<PublicUser[]>([]);
  let sections = $state<SectionCatalogEntry[]>([]);
  let createdSections = $state<SectionCatalogEntry[]>([]);
  let requests = $state<AdminRequestsResponse["requests"]>([]);
  let roster = $state<AdminRosterEntry[]>([]);
  let rosterSection = $state<SectionCatalogEntry | null>(null);
  let rosterLoading = $state(false);
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
      const [
        courseResponse,
        instructorResponse,
        sectionResponse,
        requestResponse,
      ] = await Promise.all([
        getCourses(),
        getUsers("instructor"),
        getSections(),
        getAdminRequests(),
      ]);

      courses = courseResponse ?? [];
      instructors = instructorResponse.users ?? [];
      sections = sectionResponse.sections ?? [];
      requests = requestResponse.requests ?? [];
    } catch (error) {
      feedback = {
        tone: "error",
        message: toPublicError(error),
      };
    } finally {
      isFetching = false;
    }
  }

  async function handleApprove(requestId: string) {
    feedback = null;
    try {
      await approveAdminEnrollment(requestId);
      requests = requests.filter((r) => r.id !== requestId);
      feedback = { tone: "success", message: "Enrollment approved." };
      // Refresh sections to update remaining seats
      const sectionResponse = await getSections();
      sections = sectionResponse.sections ?? [];
    } catch (error) {
      feedback = { tone: "error", message: toPublicError(error) };
    }
  }

  async function handleDeny(requestId: string) {
    feedback = null;
    try {
      await denyAdminEnrollment(requestId);
      requests = requests.filter((r) => r.id !== requestId);
      feedback = { tone: "success", message: "Enrollment denied." };
    } catch (error) {
      feedback = { tone: "error", message: toPublicError(error) };
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

<section class="admin-sections-page space-y-6">
  <Card size="xl" class="shadow-none border-slate-200 max-w-none p-4">
    <div class="flex flex-col md:flex-row justify-between gap-6">
      <div>
        <Heading tag="h1" class="text-2xl font-bold text-gray-900 dark:text-white">Section Management</Heading>
        <P class="lede mt-2 text-gray-600 dark:text-gray-400">
          Assign instructors, break courses into live offerings, and control each
          section's schedule and capacity independently.
        </P>
      </div>

      <div class="hero-stats flex gap-4" aria-label="Section summary">
        <Card size="sm" class="shadow-none border-slate-200 bg-gray-50/50 dark:bg-gray-800/50 p-4">
          <span class="stat-value text-2xl font-bold text-gray-900 dark:text-white block">{sectionCount}</span>
          <span class="stat-label text-sm text-gray-500 dark:text-gray-400">Active Sections</span>
        </Card>
        <Card size="sm" class="shadow-none border-slate-200 bg-gray-50/50 dark:bg-gray-800/50 p-4">
          <span class="stat-value text-2xl font-bold text-gray-900 dark:text-white block">{sessionSectionCount}</span>
          <span class="stat-label text-sm text-gray-500 dark:text-gray-400">Created This Session</span>
        </Card>
      </div>
    </div>
  </Card>

  {#if feedback}
    <Alert
      color={feedback.tone === "success" ? "green" : "red"}
      dismissable
      class="rounded-xl border border-current"
    >
      {feedback.message}
    </Alert>
  {/if}

  <div class="admin-grid space-y-6">
    <Card size="xl" class="shadow-none border-slate-200 max-w-none p-4">
      <div class="panel-heading mb-6 flex justify-between items-start">
        <div>
          <Heading tag="h2" class="text-xl font-bold text-gray-900 dark:text-white">Schedule offering</Heading>
        </div>
        <Badge color="blue" class="rounded-full px-3 py-1 font-bold">Section scheduling</Badge>
      </div>

      <form class="section-form space-y-6" onsubmit={handleSubmit}>
        <div class="form-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <Label for="course" class="mb-2">Course</Label>
            <Select id="course" bind:value={form.courseCode} required>
              <option value="" disabled>Select a course</option>
              {#each activeCourseOptions as course (course.id)}
                <option value={course.code}>
                  {course.code} - {course.title}
                </option>
              {/each}
            </Select>
          </div>

          <div>
            <Label for="instructor" class="mb-2">Instructor</Label>
            <Select id="instructor" bind:value={form.instructorId} required>
              <option value="" disabled>Select an instructor</option>
              {#each instructorOptions as instructor (instructor.id)}
                <option value={instructor.id}>
                  {instructor.name} ({instructor.username})
                </option>
              {/each}
            </Select>
          </div>

          <div>
            <Label for="section-name" class="mb-2">Section Name</Label>
            <Input
              id="section-name"
              bind:value={form.sectionName}
              placeholder="Section A"
              required
              class="placeholder-slate-400/50"
            />
          </div>

          <div>
            <Label for="capacity" class="mb-2">Capacity</Label>
            <Input
              id="capacity"
              bind:value={form.capacity}
              min="1"
              placeholder="30"
              required
              type="number"
            />
          </div>
        </div>

        <Card size="xl" class="shadow-none border-slate-200 bg-gray-50/30 max-w-none p-4">
          <div class="block-heading flex justify-between items-start mb-4">
            <div>
              <Heading tag="h3" class="text-lg font-bold text-gray-900 dark:text-white">Schedule Array Builder</Heading>
              <P size="sm" class="text-gray-500 dark:text-gray-400">Add day, time, and class type entries for this section.</P>
            </div>
            <Badge color="indigo" class="rounded-full px-3">{scheduleItems.length} items</Badge>
          </div>

          <div class="schedule-grid grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label for="day" class="mb-2">Day</Label>
              <Input id="day" bind:value={scheduleDraft.day} placeholder="Monday" />
            </div>

            <div>
              <Label for="time" class="mb-2">Time</Label>
              <Input
                id="time"
                bind:value={scheduleDraft.time}
                placeholder="08:00 - 09:30"
              />
            </div>

            <div>
              <Label for="type" class="mb-2">Type</Label>
              <Input 
                id="type" 
                bind:value={scheduleDraft.type} 
                placeholder="Lecture" 
                />
            </div>

            <div class="schedule-action md:col-span-3">
              <Button color="alternative" type="button" class="w-full md:w-auto" onclick={addScheduleItem}>
                Add Schedule Item
              </Button>
            </div>
          </div>

          {#if scheduleItems.length > 0}
            <div class="schedule-list mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each scheduleItems as item, index (item.day + item.time + item.type + index)}
                <Card size="sm" class="flex-row justify-between items-center gap-4 p-3 bg-white dark:bg-gray-800">
                  <div class="min-w-0">
                    <strong class="text-gray-900 dark:text-white">{item.day}</strong>
                    <P size="sm" class="text-gray-500 dark:text-gray-400 truncate">{item.time} · {item.type}</P>
                  </div>
                  <Button
                    size="xs"
                    color="red"
                    outline
                    onclick={() => removeScheduleItem(index)}
                  >
                    Remove
                  </Button>
                </Card>
              {/each}
            </div>
          {:else}
            <div class="empty-copy mt-4 p-4 bg-white/50 border border-dashed border-slate-200 rounded-lg text-center text-gray-500 dark:bg-gray-800/50 dark:border-gray-600">
              No schedule items yet. Add at least one before saving.
            </div>
          {/if}
        </Card>

        <div class="form-actions flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : "Create Section"}
          </Button>
          <Button color="alternative" type="button" onclick={resetForm}>
            Reset Form
          </Button>
        </div>
      </form>
    </Card>

    <Card size="xl" class="shadow-none border-slate-200 max-w-none mt-6 p-4">
      <div class="panel-heading mb-6 flex justify-between items-center">
        <div>
          <p class="eyebrow">Pending Registration Approvals</p>
          <Heading tag="h2" class="text-xl font-bold text-gray-900 dark:text-white">Approval Queue</Heading>
        </div>
        <Badge color="indigo" class="rounded-full px-3 py-1 font-bold">{requests.length} pending</Badge>
      </div>

      {#if isFetching}
        <div class="empty-copy py-8 text-center text-gray-500">Loading queue…</div>
      {:else if requests.length === 0}
        <div class="empty-copy py-8 text-center text-gray-500">Queue is empty. No pending requests.</div>
      {:else}
        <Table hoverable={true} class="shadow-none border border-slate-200 rounded-lg overflow-hidden">
          <TableHead class="bg-gray-50 dark:bg-gray-800">
            <TableHeadCell>Student</TableHeadCell>
            <TableHeadCell>Course</TableHeadCell>
            <TableHeadCell>Section</TableHeadCell>
            <TableHeadCell>Requested</TableHeadCell>
            <TableHeadCell>Actions</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each requests as req (req.id)}
              <TableBodyRow>
                <TableBodyCell>
                  <div class="font-bold text-gray-900 dark:text-white">{req.student?.name}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{req.student?.username}</div>
                </TableBodyCell>
                <TableBodyCell>
                  <div class="font-bold text-gray-900 dark:text-white">{req.course?.id}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{req.course?.title}</div>
                </TableBodyCell>
                <TableBodyCell class="text-gray-900 dark:text-white">{req.section?.sectionName}</TableBodyCell>
                <TableBodyCell class="text-gray-900 dark:text-white">
                  {new Date(req.dateRequested).toLocaleDateString()}
                </TableBodyCell>
                <TableBodyCell>
                  <div class="flex gap-2">
                    <Button
                      size="xs"
                      color="green"
                      onclick={() => void handleApprove(req.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      outline
                      onclick={() => void handleDeny(req.id)}
                    >
                      Deny
                    </Button>
                  </div>
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </Card>

    <Card size="xl" class="shadow-none border-slate-200 max-w-none mt-6 p-4">
      <div class="panel-heading mb-6 flex justify-between items-center">
        <div>
          <p class="eyebrow">Live Sections</p>
          <Heading tag="h2" class="text-xl font-bold text-gray-900 dark:text-white">Active schedule</Heading>
        </div>
        <Badge color={isFetching ? "yellow" : "green"} class="rounded-full px-3 py-1 font-bold">
          {isFetching ? "Refreshing" : "Live view"}
        </Badge>
      </div>

      {#if isFetching}
        <div class="empty-copy py-8 text-center text-gray-500">Loading sections…</div>
      {:else if sections.length === 0}
        <div class="empty-copy py-8 text-center text-gray-500">No live sections yet.</div>
      {:else}
        <Table hoverable={true} class="shadow-none border border-slate-200 rounded-lg overflow-hidden">
          <TableHead class="bg-gray-50 dark:bg-gray-800">
            <TableHeadCell>Course</TableHeadCell>
            <TableHeadCell>Section</TableHeadCell>
            <TableHeadCell>Instructor</TableHeadCell>
            <TableHeadCell>Capacity</TableHeadCell>
            <TableHeadCell>Seats</TableHeadCell>
            <TableHeadCell>Schedule</TableHeadCell>
            <TableHeadCell>Actions</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each sections as section (section.id)}
              <TableBodyRow>
                <TableBodyCell>
                  <div class="font-bold text-gray-900 dark:text-white">{section.courseCode}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{section.courseTitle}</div>
                </TableBodyCell>
                <TableBodyCell class="text-gray-900 dark:text-white">{section.sectionName}</TableBodyCell>
                <TableBodyCell class="text-gray-900 dark:text-white">{section.instructorName}</TableBodyCell>
                <TableBodyCell class="text-gray-900 dark:text-white text-center">{section.capacity}</TableBodyCell>
                <TableBodyCell>
                  <Badge color="blue" class="rounded-full px-2 py-0.5">
                    {section.remainingSeats} / {section.capacity}
                  </Badge>
                </TableBodyCell>
                <TableBodyCell>
                  <div class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic">
                    {formatSchedule(section.scheduleArray)}
                  </div>
                </TableBodyCell>
                <TableBodyCell>
                  <Button
                    size="xs"
                    color="alternative"
                    onclick={() => void viewRoster(section)}
                  >
                    View Roster
                  </Button>
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </Card>
  </div>

  {#if rosterSection}
    <Card size="xl" class="shadow-none border-slate-200 max-w-none mt-6 p-4">
      <div class="panel-heading mb-6 flex justify-between items-center">
        <div>
          <p class="eyebrow">Roster View</p>
          <Heading tag="h2" class="text-xl font-bold text-gray-900 dark:text-white">
            {rosterSection.courseCode} - {rosterSection.sectionName}
          </Heading>
        </div>
        <Badge color="indigo" class="rounded-full px-3 py-1 font-bold">
          {rosterLoading ? "Loading roster" : `${roster.length} students`}
        </Badge>
      </div>

      {#if rosterLoading}
        <div class="empty-copy py-8 text-center text-gray-500">Loading roster…</div>
      {:else if roster.length === 0}
        <div class="empty-copy py-8 text-center text-gray-500">No enrollments found for this section.</div>
      {:else}
        <Table hoverable={true} class="shadow-none border border-slate-200 rounded-lg overflow-hidden">
          <TableHead class="bg-gray-50 dark:bg-gray-800">
            <TableHeadCell>Student ID</TableHeadCell>
            <TableHeadCell>Student Name</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell>Grade</TableHeadCell>
            <TableHeadCell>Remarks</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each roster as row (row.id)}
              <TableBodyRow>
                <TableBodyCell class="text-gray-900 dark:text-white">{row.student.id}</TableBodyCell>
                <TableBodyCell>
                  <div class="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{row.student.name}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{row.student.username}</div>
                </TableBodyCell>
                <TableBodyCell>
                  <Badge color={row.status === "finalized" ? "green" : "blue"} class="rounded-full px-2 py-0.5 capitalize">
                    {row.status}
                  </Badge>
                </TableBodyCell>
                <TableBodyCell>
                  <div class="flex items-center gap-2">
                    <span class="text-gray-900 dark:text-white">{row.grade ?? "—"}</span>
                    {#if isFinalized(row)}
                      <Badge color="green" class="rounded-full px-2 py-0.5 text-[10px]">🔒 Finalized</Badge>
                    {/if}
                  </div>
                </TableBodyCell>
                <TableBodyCell class="text-gray-500 dark:text-gray-400 italic truncate max-w-[200px]">
                  {row.remark ?? "—"}
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </Card>
  {/if}
</section>

<style>
  .admin-sections-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.76rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #3b82f6;
    font-weight: 700;
  }
</style>
