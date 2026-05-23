<script lang="ts">
  import { onMount } from "svelte";
  import { authSession } from "$lib/stores/auth";
  import {
    getStudentCourses,
    getCourses,
    enrollStudent,
  } from "$lib/api/client";
  import { writable, derived, get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const session = derived(authSession, ($s) => $s);

  type StudentCoursesResult = Awaited<ReturnType<typeof getStudentCourses>>;
  type CourseList = Awaited<ReturnType<typeof getCourses>>;

  const student = writable<StudentCoursesResult["student"] | null>(null);
  const enrolled = writable<StudentCoursesResult["enrollments"]>([]);
  const catalog = writable<CourseList>([]);
  const loadingEnrolled = writable(true);
  const loadingCatalog = writable(true);
  const error = writable("");

  async function refreshEnrolled() {
    loadingEnrolled.set(true);
    error.set("");
    try {
      const s = get(session);
      if (!s) return;
      const res = await getStudentCourses(s.user.id);
      student.set(res.student ?? null);
      enrolled.set(res.enrollments ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error.set(msg);
    } finally {
      loadingEnrolled.set(false);
    }
  }

  async function refreshCatalog() {
    loadingCatalog.set(true);
    try {
      const res = await getCourses();
      const enrolledCourseCodes = new Set(
        get(enrolled).map((entry) => entry.courseCode),
      );
      catalog.set(
        (res ?? []).filter((course) => !enrolledCourseCodes.has(course.code)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error.set(msg);
    } finally {
      loadingCatalog.set(false);
    }
  }

  async function handleEnroll(courseCode: string) {
    error.set("");
    try {
      const s = get(session);
      if (!s) throw new Error("Not authenticated");
      await enrollStudent(s.user.id, courseCode);
      await refreshEnrolled();
      await refreshCatalog();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error.set(msg);
    }
  }

  onMount(() => {
    const s = get(session);
    if (!s) {
      void goto(resolve("/login"));
      return;
    }

    if (s.user.role !== "student") {
      const target = s.user.role === "instructor" ? "/instructor" : "/admin";
      void goto(resolve(target));
      return;
    }

    void (async () => {
      await refreshEnrolled();
      await refreshCatalog();
    })();
  });
</script>

<svelte:head>
  <title>Available Courses</title>
</svelte:head>

<main class="container mx-auto max-w-[1000px] p-5">
  <div class="mb-4 rounded-lg bg-white p-4 text-[#111] shadow-sm">
    {#if $student}
      <h2 class="mb-1">Available Courses</h2>
      <p class="m-0 text-[#555]">
        Signed in as {$student.name} · {$student.section}
      </p>
    {:else}
      <h2>Available Courses</h2>
    {/if}
  </div>

  {#if $error}
    <div class="mb-4" data-tone="error">{$error}</div>
  {/if}

  <aside class="rounded-lg bg-white p-4 text-[#111] shadow-sm">
    <header class="mb-2">
      <h3 class="m-0">Available Course Catalog</h3>
    </header>

    <div class="panel">
      {#if $loadingCatalog}
        <div>Loading catalog…</div>
      {:else if $catalog.length === 0}
        <div>No courses available.</div>
      {:else}
        <ul class="m-0 grid list-none gap-2 p-0">
          {#each $catalog as c (c.code)}
            <li
              class="flex items-center justify-between rounded-md border border-[#f0f0f0] p-2"
            >
              <div>
                <div class="font-semibold">{c.code} — {c.title}</div>
                <div class="text-sm text-[#666]">{c.schedule}</div>
                <div class="mt-1 text-[0.85rem] text-[#333]">
                  Capacity: {c.enrolledCount}/{c.capacity} —
                  <strong>{c.remainingSeats} seats left</strong>
                </div>
              </div>
              <div>
                <button
                  class="rounded-md border border-[#2b6cb0] bg-[#2b6cb0] px-[0.7rem] py-[0.45rem] text-white"
                  onclick={() => handleEnroll(c.code)}
                  disabled={c.remainingSeats <= 0}
                >
                  {c.remainingSeats <= 0 ? "Full" : "Enroll"}
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </aside>
</main>
