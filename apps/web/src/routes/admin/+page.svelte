<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";
  import {
    decideAdminRequest,
    getAdminRequests,
    type AdminRequestsResponse,
  } from "$lib/api/client";

  let session = $derived($authSession);
  let requests = $state<AdminRequestsResponse["requests"]>([]);
  let loading = $state(true);
  let error = $state("");
  let actionId = $state<string | null>(null);

  async function refreshQueue() {
    loading = true;
    error = "";

    try {
      const res = await getAdminRequests();
      requests = res.requests ?? [];
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Unable to load request queue.";
    } finally {
      loading = false;
    }
  }

  async function handleDecision(
    enrollmentId: string,
    action: "approve" | "deny",
  ) {
    error = "";
    actionId = enrollmentId;

    try {
      await decideAdminRequest(enrollmentId, action);
      const index = requests.findIndex(
        (request) => request.id === enrollmentId,
      );

      if (index !== -1) {
        requests.splice(index, 1);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Unable to update request.";
    } finally {
      actionId = null;
    }
  }

  onMount(() => {
    const currentSession = session;

    if (!currentSession || currentSession.user.role !== "admin") {
      void goto(resolve("/login"));
      return;
    }

    void refreshQueue();
  });
</script>

<svelte:head>
  <title>Admin Control Center</title>
</svelte:head>

<section class="mx-auto max-w-6xl p-6 text-slate-100">
  <div
    class="mb-6 rounded-2xl border border-slate-700 bg-slate-950/90 p-6 shadow-2xl shadow-slate-950/30"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
      Request Queue
    </p>
    <h2 class="mt-2 text-3xl font-semibold text-white">Admin Control Center</h2>
    <p class="mt-2 max-w-2xl text-sm text-slate-400">
      Review pending enrollments, approve eligible students, or deny requests
      that do not meet policy.
    </p>
  </div>

  {#if error}
    <div
      class="mb-5 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-200"
    >
      {error}
    </div>
  {/if}

  <div
    class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/20"
  >
    <div class="border-b border-slate-800 px-6 py-4">
      <h3 class="text-lg font-semibold text-white">
        Pending Enrollment Requests
      </h3>
      <p class="mt-1 text-sm text-slate-400">
        {loading
          ? "Loading the queue…"
          : `${requests.length} request${requests.length === 1 ? "" : "s"} in queue`}
      </p>
    </div>

    {#if loading}
      <div class="px-6 py-10 text-sm text-slate-400">Loading queue…</div>
    {:else if requests.length === 0}
      <div class="px-6 py-10 text-sm text-slate-400">
        No pending enrollment requests.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead class="bg-slate-900/80 text-slate-300">
            <tr>
              <th scope="col" class="px-6 py-4 font-medium">Student</th>
              <th scope="col" class="px-6 py-4 font-medium">Course</th>
              <th scope="col" class="px-6 py-4 font-medium">Status</th>
              <th scope="col" class="px-6 py-4 font-medium">Requested</th>
              <th scope="col" class="px-6 py-4 font-medium text-right"
                >Action</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-900 bg-slate-950">
            {#each requests as request (request.id)}
              <tr class="transition-colors hover:bg-slate-900/60">
                <td class="px-6 py-4 align-top">
                  <div class="font-semibold text-white">
                    {request.student?.name ?? request.studentId}
                  </div>
                  <div class="text-xs text-slate-400">{request.studentId}</div>
                </td>
                <td class="px-6 py-4 align-top">
                  <div class="font-semibold text-cyan-200">
                    {request.course?.code ?? request.courseCode}
                  </div>
                  <div class="text-xs text-slate-400">
                    {request.course?.title ?? "Course details unavailable"}
                  </div>
                  {#if request.course?.schedule}
                    <div class="mt-1 text-xs text-slate-500">
                      {request.course.schedule}
                    </div>
                  {/if}
                </td>
                <td class="px-6 py-4 align-top">
                  <span
                    class="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200"
                  >
                    {request.status}
                  </span>
                </td>
                <td class="px-6 py-4 align-top text-slate-300">
                  {request.createdAt}
                </td>
                <td class="px-6 py-4 align-top">
                  <div class="flex justify-end gap-3">
                    <button
                      type="button"
                      class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={actionId === request.id}
                      onclick={() => handleDecision(request.id, "approve")}
                    >
                      {actionId === request.id ? "Approving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={actionId === request.id}
                      onclick={() => handleDecision(request.id, "deny")}
                    >
                      {actionId === request.id ? "Denying…" : "Deny"}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
