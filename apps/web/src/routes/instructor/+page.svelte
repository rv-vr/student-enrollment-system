<script lang="ts">
  import { onMount } from "svelte";
  import { authSession } from "$lib/stores/auth";
  import { getInstructorClasses, updateEnrollmentGrade } from "$lib/api/client";
  import { writable, derived, get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const classes = writable<unknown[]>([]);
  const loading = writable(true);
  const error = writable("");

  const session = derived(authSession, ($s) => $s);

  async function refresh() {
    loading.set(true);
    error.set("");
    try {
      const res = await getInstructorClasses();
      classes.set(res.classes ?? []);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : String(err ?? "Unable to load classes");
      error.set(msg);
    } finally {
      loading.set(false);
    }
  }

  async function saveGrade(enrollmentId: string, value: string | number) {
    error.set("");
    try {
      await updateEnrollmentGrade(
        enrollmentId,
        value === "" ? null : Number(value),
      );
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : String(err ?? "Unable to save grade");
      error.set(msg);
    }
  }

  onMount(() => {
    const s = get(session);
    if (!s || s.user.role !== "instructor") {
      // client-only redirect; let layouts handle canonical home
      void goto(resolve("/login"));
      return;
    }

    void refresh();
  });
</script>

<svelte:head>
  <title>Instructor Dashboard</title>
</svelte:head>

<section class="instructor-page">
  {#if $loading}
    <div>Loading classes…</div>
  {:else}
    {#if $error}
      <div class="banner" data-tone="error">{$error}</div>
    {/if}

    {#if $classes.length === 0}
      <div>No assigned classes found.</div>
    {/if}

    {#each $classes as entry (entry?.course?.code)}
      <div class="course-card">
        <h3>{entry.course.code} — {entry.course.title}</h3>
        <p>{entry.course.schedule}</p>

        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Student ID</th>
              <th>Section</th>
              <th>Grade</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {#each entry.roster as r (r.id)}
              <tr>
                <td>{r.student?.name}</td>
                <td>{r.studentId}</td>
                <td>{r.section}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.01"
                    value={r.grade ?? ""}
                    on:change={(e) => (r._pending = e.target.value)}
                  />
                </td>
                <td>
                  <button
                    on:click={() =>
                      saveGrade(r.id, r._pending ?? r.grade ?? "")}>Save</button
                  >
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  {/if}
</section>
