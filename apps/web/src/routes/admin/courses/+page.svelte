<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";
  import {
    ApiError,
    createAdminCourse,
    getCourses,
    deleteAdminCourse,
    type AdminCourseCreatePayload,
  } from "$lib/api/client";
  import type { CourseCatalogEntry } from "$lib/api/types";
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
    Textarea,
    Button,
    Alert,
    Checkbox,
    Modal,
    Toast,
    ToastContainer,
  } from "flowbite-svelte";
  import { fly } from "svelte/transition";
  import { TrashBinOutline, CloseCircleSolid } from "flowbite-svelte-icons";

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

  type ToastItem = {
    id: number;
    message: string;
    color: "green" | "red" | "yellow" | "blue";
    visible: boolean;
    timeoutId?: ReturnType<typeof setTimeout>;
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

  let deleteModal = $state(false);
  let courseToDelete = $state<CourseCatalogEntry | null>(null);

  let toasts = $state<ToastItem[]>([]);
  let nextToastId = $state(1);

  function addToast(message: string, color: ToastItem["color"] = "green") {
    const id = nextToastId++;
    const newToast: ToastItem = {
      id,
      message,
      color,
      visible: true,
    };

    const timeoutId = setTimeout(() => {
      dismissToast(id);
    }, 5000);
    newToast.timeoutId = timeoutId;

    toasts = [...toasts, newToast];
  }

  function dismissToast(id: number) {
    const toast = toasts.find((t) => t.id === id);
    if (toast?.timeoutId) {
      clearTimeout(toast.timeoutId);
    }
    toasts = toasts.map((t) => (t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 300);
  }

  function confirmDelete(course: CourseCatalogEntry) {
    courseToDelete = course;
    deleteModal = true;
  }

  async function handleDelete() {
    if (!courseToDelete) return;

    try {
      await deleteAdminCourse(courseToDelete.id);
      courses = courses.filter((c) => c.id !== courseToDelete!.id);
      addToast(`Course ${courseToDelete.code} deleted successfully.`, "green");
    } catch (error) {
      addToast(toPublicError(error), "red");
    } finally {
      deleteModal = false;
      courseToDelete = null;
    }
  }

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
          (course) =>
            normalizeCode(course.code) !== normalizeCode(createdCourse.code),
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

<section class="admin-courses-page space-y-6">
  <ToastContainer position="top-right" class="z-50">
    {#each toasts as toast (toast.id)}
      <Toast
        color={toast.color}
        dismissable={true}
        transition={fly}
        params={{ x: 200, duration: 300 }}
        class="mb-4"
        onclose={() => dismissToast(toast.id)}
        bind:toastStatus={toast.visible}
      >
        {#snippet icon()}
          {#if toast.color === "red"}
            <CloseCircleSolid class="h-5 w-5" />
          {/if}
        {/snippet}
        {toast.message}
      </Toast>
    {/each}
  </ToastContainer>

  <Modal
    title="Confirm Deletion"
    bind:open={deleteModal}
    autoclose
    size="sm"
    class="z-50"
  >
    <div class="text-center">
      <TrashBinOutline class="mx-auto mb-4 text-gray-400 w-12 h-12" />
      <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
        Are you sure you want to delete course <strong
          >{courseToDelete?.code}</strong
        >? This action cannot be undone.
      </h3>
      <div class="flex justify-center gap-4">
        <Button color="red" onclick={handleDelete}>Confirm Delete</Button>
        <Button color="alternative" onclick={() => (deleteModal = false)}
          >Cancel</Button
        >
      </div>
    </div>
  </Modal>

  <Card size="xl" class="shadow-none border-slate-200 max-w-none">
    <div class="flex flex-col md:flex-row justify-between gap-6 p-4">
      <div>
        <Heading
          tag="h1"
          class="text-2xl font-bold text-gray-900 dark:text-white"
          >Course Catalog Control</Heading
        >
        <P class="lede mt-2 text-gray-600 dark:text-gray-400">
          Register new courses, assign prerequisite chains, and keep the live
          catalog current.
        </P>
      </div>

      <div class="hero-stats flex gap-4" aria-label="Catalog summary">
        <Card
          size="sm"
          class="shadow-none border-slate-200 bg-gray-50/50 dark:bg-gray-800/50 p-4"
        >
          <span
            class="stat-value text-2xl font-bold text-gray-900 dark:text-white block"
            >{courseCount}</span
          >
          <span class="stat-label text-sm text-gray-500 dark:text-gray-400"
            >Active Courses</span
          >
        </Card>
        <Card
          size="sm"
          class="shadow-none border-slate-200 bg-gray-50/50 dark:bg-gray-800/50 p-4"
        >
          <span
            class="stat-value text-2xl font-bold text-gray-900 dark:text-white block"
            >{recentCount}</span
          >
          <span class="stat-label text-sm text-gray-500 dark:text-gray-400"
            >Created This Session</span
          >
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
          <p class="eyebrow">Create New Course</p>
          <Heading
            tag="h2"
            class="text-xl font-bold text-gray-900 dark:text-white"
            >Register course</Heading
          >
        </div>
      </div>

      <form class="course-form space-y-6" onsubmit={handleSubmit}>
        <div class="form-grid grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label for="course-code" class="mb-2">Course Code</Label>
            <Input
              id="course-code"
              bind:value={form.id}
              autocomplete="off"
              placeholder="CS101"
              required
              class="placeholder-slate-400/50"
            />
          </div>

          <div>
            <Label for="title" class="mb-2">Title</Label>
            <Input
              id="title"
              bind:value={form.title}
              autocomplete="off"
              placeholder="Introduction to Computing"
              required
              class="placeholder-slate-400/50"
            />
          </div>

          <div>
            <Label for="capacity" class="mb-2">Capacity</Label>
            <Input
              id="capacity"
              bind:value={form.capacity}
              inputmode="numeric"
              min="1"
              placeholder="30"
              required
              type="number"
            />
          </div>

          <div>
            <Label for="lecCredits" class="mb-2">Lecture Credits</Label>
            <Input
              id="lecCredits"
              bind:value={form.lecCredits}
              inputmode="decimal"
              min="0"
              step="1"
              placeholder="3"
              required
              type="number"
            />
          </div>

          <div>
            <Label for="labCredits" class="mb-2">Lab Credits</Label>
            <Input
              id="labCredits"
              bind:value={form.labCredits}
              inputmode="decimal"
              min="0"
              step="1"
              placeholder="1"
              required
              type="number"
            />
          </div>

          <div class="col-span-full">
            <Label for="description" class="mb-2">Description</Label>
            <Textarea
              id="description"
              bind:value={form.description}
              placeholder="Short catalog description"
              rows="4"
              class="w-full placeholder-slate-400/50"
            ></Textarea>
          </div>
        </div>

        <Card
          size="xl"
          class="shadow-none border-slate-200 bg-gray-50/30 max-w-none p-4"
        >
          <div class="block-heading flex justify-between items-start mb-4">
            <div>
              <Heading
                tag="h3"
                class="text-lg font-bold text-gray-900 dark:text-white"
                >Prerequisite Selector</Heading
              >
              <P size="sm" class="text-gray-500 dark:text-gray-400"
                >Pick existing courses that must be completed first.</P
              >
            </div>
            <Badge color="indigo" class="rounded-full px-3"
              >{form.prerequisites.length} selected</Badge
            >
          </div>

          {#if prerequisiteOptions.length > 0}
            <div
              class="checkbox-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              role="group"
              aria-label="Prerequisites"
            >
              {#each prerequisiteOptions as course (course.id)}
                <div
                  class="checkbox-card flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-white hover:bg-gray-50 transition-colors cursor-pointer dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <Checkbox
                    bind:group={form.prerequisites}
                    value={course.code}
                    class="mt-1"
                  />
                  <div class="flex flex-col min-w-0">
                    <span
                      class="font-bold text-gray-900 dark:text-white truncate"
                      >{course.code}</span
                    >
                    <span
                      class="text-xs text-gray-500 dark:text-gray-400 truncate"
                      >{course.title}</span
                    >
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div
              class="empty-copy p-4 bg-white/50 border border-dashed border-slate-200 rounded-lg text-center text-gray-500 dark:bg-gray-800/50 dark:border-gray-600"
            >
              Add at least one course before chaining prerequisites.
            </div>
          {/if}
        </Card>

        <div class="form-actions flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : "Create Course"}
          </Button>
          <Button color="alternative" type="button" onclick={resetForm}>
            Reset Form
          </Button>
        </div>
      </form>
    </Card>

    <Card size="xl" class="shadow-none border-slate-200 max-w-none p-4">
      <div class="panel-heading mb-6 flex justify-between items-center">
        <div>
          <p class="eyebrow">Catalog Snapshot</p>
          <Heading
            tag="h2"
            class="text-xl font-bold text-gray-900 dark:text-white"
            >Active catalog</Heading
          >
        </div>
        <Badge
          color={isFetching ? "yellow" : "green"}
          class="rounded-full px-3 py-1 font-bold"
        >
          {isFetching ? "Refreshing" : "Live view"}
        </Badge>
      </div>

      {#if isFetching}
        <div class="empty-copy py-8 text-center text-gray-500">
          Loading course catalog…
        </div>
      {:else if courses.length === 0}
        <div class="empty-state py-8 text-center text-gray-500">
          No courses registered yet.
        </div>
      {:else}
        <Table
          hoverable={true}
          class="shadow-none border border-slate-200 rounded-lg overflow-hidden"
        >
          <TableHead class="bg-gray-50 dark:bg-gray-800">
            <TableHeadCell>Code</TableHeadCell>
            <TableHeadCell>Title</TableHeadCell>
            <TableHeadCell>Credits</TableHeadCell>
            <TableHeadCell>Seats / Capacity</TableHeadCell>
            <TableHeadCell>Prerequisites</TableHeadCell>
            <TableHeadCell>Actions</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each courses as course (course.id)}
              <TableBodyRow>
                <TableBodyCell class="font-bold text-gray-900 dark:text-white"
                  >{course.code}</TableBodyCell
                >
                <TableBodyCell>
                  <div
                    class="course-title font-bold text-gray-900 dark:text-white truncate max-w-[200px]"
                  >
                    {course.title}
                  </div>
                  {#if course.description}
                    <div
                      class="course-description text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px] mt-1"
                    >
                      {course.description}
                    </div>
                  {/if}
                </TableBodyCell>
                <TableBodyCell class="whitespace-nowrap"
                  >{formatCredits(course)}</TableBodyCell
                >
                <TableBodyCell>
                  <Badge color="blue" class="rounded-full px-2 py-0.5">
                    {course.remainingSeats} / {course.capacity}
                  </Badge>
                </TableBodyCell>
                <TableBodyCell class="max-w-[200px] truncate"
                  >{formatPrerequisites(course)}</TableBodyCell
                >
                <TableBodyCell>
                  <Button
                    size="xs"
                    color="red"
                    outline
                    onclick={() => confirmDelete(course)}
                    aria-label="Delete course"
                  >
                    <TrashBinOutline class="w-4 h-4" />
                  </Button>
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </Card>
  </div>
</section>

<style>
  .admin-courses-page {
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
