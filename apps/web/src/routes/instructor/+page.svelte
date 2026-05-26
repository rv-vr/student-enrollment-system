<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import {
    client,
    finalizeInstructorSection,
    type InstructorSectionsResponse,
  } from "$lib/api/client";
  import { authSession } from "$lib/stores/auth";
  import { Button } from "flowbite-svelte";

  type InstructorSection = InstructorSectionsResponse["sections"][number];
  type InstructorRosterRow = InstructorSection["roster"][number] & {
    draftGrade: string;
    draftRemark: string;
    saveState: "idle" | "saving" | "saved" | "error";
    saveMessage: string;
  };

  type FeedbackState = {
    tone: "success" | "error";
    message: string;
  };

  let session = $derived($authSession);
  let assignedSections = $state<InstructorSection[]>([]);
  let selectedSectionId = $state("");
  let roster = $state<InstructorRosterRow[]>([]);
  let feedback = $state<FeedbackState | null>(null);
  let finalizing = $state(false);

  let bootstrappedUserId = $state<string | null>(null);
  let lastLoadedSectionId = $state("");
  let requestVersion = 0;

  const isLocked = $derived(roster.some((row) => row.status === "finalized"));
  const selectedSection = $derived(
    assignedSections.find(
      (section) => section.section.id === selectedSectionId,
    ) ?? null,
  );

  function toMessage(error: unknown, fallback: string) {
    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }

  function mapRoster(section: InstructorSection) {
    roster = (section.roster ?? []).map((entry) => ({
      ...entry,
      draftGrade:
        entry.grade === null || entry.grade === undefined
          ? ""
          : String(entry.grade),
      draftRemark: entry.remark ?? "",
      saveState: "idle",
      saveMessage: "",
    }));
  }

  function lockRoster() {
    roster = roster.map((row) => ({
      ...row,
      status: "finalized",
      saveState: "idle",
      saveMessage: "",
    }));
  }

  async function loadSectionsAndRoster(preferredSectionId?: string) {
    const version = ++requestVersion;

    feedback = null;

    try {
      const response = await client.api.instructor.sections.$get();

      if (version !== requestVersion) {
        return;
      }

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

      const payload = (await response.json()) as InstructorSectionsResponse;

      assignedSections = payload.sections ?? [];

      const nextSelectedId =
        preferredSectionId &&
        assignedSections.some(
          (section) => section.section.id === preferredSectionId,
        )
          ? preferredSectionId
          : (assignedSections[0]?.section.id ?? "");

      selectedSectionId = nextSelectedId;
      lastLoadedSectionId = nextSelectedId;

      const activeSection = assignedSections.find(
        (section) => section.section.id === nextSelectedId,
      );

      roster = [];

      if (activeSection) {
        mapRoster(activeSection);
      }
    } catch (error) {
      if (version !== requestVersion) {
        return;
      }

      assignedSections = [];
      selectedSectionId = "";
      roster = [];
      lastLoadedSectionId = "";
      feedback = {
        tone: "error",
        message: toMessage(error, "Unable to load assigned sections."),
      };
    }
  }

  async function saveGrade(row: InstructorRosterRow) {
    if (isLocked) {
      return;
    }

    const grade = row.draftGrade.trim() === "" ? null : row.draftGrade.trim();
    const remark =
      row.draftRemark.trim() === "" ? null : row.draftRemark.trim();

    row.saveState = "saving";
    row.saveMessage = "";
    feedback = null;

    try {
      const response = await client.api.enrollments[":id"].grade.$patch({
        param: { id: row.id },
        json: { grade, remark },
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

      const payload = (await response.json().catch(() => null)) as {
        enrollment?: { grade?: number | null; remark?: string | null };
      } | null;

      if (payload?.enrollment) {
        row.draftGrade =
          payload.enrollment.grade === null ||
          payload.enrollment.grade === undefined
            ? ""
            : String(payload.enrollment.grade);
        row.draftRemark = payload.enrollment.remark ?? "";
      }

      row.saveState = "saved";
      row.saveMessage = "Grade Saved!";
      feedback = {
        tone: "success",
        message: "Grade Saved!",
      };

      window.setTimeout(() => {
        if (row.saveState === "saved") {
          row.saveState = "idle";
          row.saveMessage = "";
        }
      }, 2000);

      window.setTimeout(() => {
        if (feedback?.message === "Grade Saved!") {
          feedback = null;
        }
      }, 2000);
    } catch (error) {
      row.saveState = "error";
      row.saveMessage = toMessage(error, "Unable to save grade.");
      feedback = {
        tone: "error",
        message: row.saveMessage,
      };
    }
  }

  async function finalizeLedger() {
    if (!selectedSectionId || finalizing || isLocked) {
      return;
    }

    finalizing = true;
    feedback = null;

    try {
      const response = await finalizeInstructorSection(selectedSectionId);

      if (!response) {
        throw new Error("Unable to finalize ledger.");
      }

      lockRoster();
      feedback = {
        tone: "success",
        message: "Ledger finalized. Grades are now read-only.",
      };
    } catch (error) {
      feedback = {
        tone: "error",
        message: toMessage(error, "Unable to finalize ledger."),
      };
    } finally {
      finalizing = false;
    }
  }

  $effect(() => {
    const currentSession = session;

    if (!currentSession) {
      return;
    }

    if (currentSession.user.role !== "instructor") {
      void goto(resolve("/login"));
      return;
    }

    if (bootstrappedUserId === currentSession.user.id) {
      return;
    }

    bootstrappedUserId = currentSession.user.id;
    void loadSectionsAndRoster();
  });

  $effect(() => {
    if (!session || session.user.role !== "instructor") {
      return;
    }

    if (!selectedSectionId || selectedSectionId === lastLoadedSectionId) {
      return;
    }

    lastLoadedSectionId = selectedSectionId;
    void loadSectionsAndRoster(selectedSectionId);
  });
</script>

<svelte:head>
  <title>Instructor Grading Ledger</title>
</svelte:head>

<section class="instructor-page">
  {#if isLocked}
    <div class="locked-banner" role="status">
      <strong
        >⚠️ This ledger has been finalized and submitted to the registrar.
        Grades are read-only.</strong
      >
    </div>
  {/if}

  <div class="toolbar">
    <label for="section-select">Section</label>
    <select id="section-select" bind:value={selectedSectionId}>
      <option value="">Select a section</option>
      {#each assignedSections as entry (entry.section.id)}
        <option value={entry.section.id}>
          {entry.section.courseCode} - {entry.section.sectionName}
        </option>
      {/each}
    </select>
  </div>

  {#if feedback}
    <p class="feedback" data-tone={feedback.tone}>{feedback.message}</p>
  {/if}

  {#if selectedSectionId}
    <div
      class="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm"
    >
      <table
        class="w-full min-w-[600px] border-collapse text-left text-sm text-slate-500"
      >
        <thead>
          <tr>
            <th class="whitespace-nowrap">Student ID</th>
            <th class="whitespace-nowrap">Student Name</th>
            <th class="whitespace-nowrap">Current Grade</th>
            <th class="whitespace-nowrap">Academic Remark</th>
            <th class="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if roster.length === 0}
            <tr>
              <td colspan="5" class="whitespace-nowrap"
                >No enrolled students found.</td
              >
            </tr>
          {:else}
            {#each roster as row (row.id)}
              <tr>
                <td class="whitespace-nowrap">{row.studentId}</td>
                <td>
                  <span class="block max-w-[200px] truncate"
                    >{row.student?.name ?? "Unknown student"}</span
                  >
                </td>
                <td class="whitespace-nowrap">
                  <input
                    type="text"
                    bind:value={row.draftGrade}
                    disabled={isLocked}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    bind:value={row.draftRemark}
                    disabled={isLocked}
                  />
                </td>
                <td class="whitespace-nowrap">
                  <div class="row-actions">
                    {#if !isLocked}
                      <Button
                        size="xs"
                        class="px-3 py-1.5 font-medium"
                        onclick={() => void saveGrade(row)}
                        disabled={row.saveState === "saving"}
                      >
                        Save Grade
                      </Button>
                    {/if}
                    {#if row.saveMessage}
                      <span class="row-status" data-tone={row.saveState}>
                        {row.saveMessage}
                      </span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    {#if !isLocked}
      <div class="footer-actions">
        <button
          type="button"
          class="finalize-button"
          onclick={() => void finalizeLedger()}
          disabled={finalizing || !selectedSection || roster.length === 0}
        >
          {finalizing ? "Finalizing..." : "Finalize & Lock Ledger"}
        </button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .instructor-page {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .locked-banner {
    padding: 0.9rem 1rem;
    border: 1px solid #e0a800;
    background: #fff7df;
    color: #6b4e00;
    border-radius: 0.75rem;
  }

  .toolbar {
    display: grid;
    gap: 0.5rem;
    max-width: 24rem;
  }

  .feedback {
    margin: 0;
  }

  .feedback[data-tone="error"],
  .row-status[data-tone="error"] {
    color: #b42318;
  }

  .feedback[data-tone="success"],
  .row-status[data-tone="saved"] {
    color: #0f7a42;
  }

  th,
  td {
    padding: 0.75rem;
    border-bottom: 1px solid #d9dde3;
    text-align: left;
    vertical-align: top;
  }

  input,
  select,
  button {
    font: inherit;
  }

  input,
  select {
    width: 100%;
    box-sizing: border-box;
  }

  .row-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .footer-actions {
    display: flex;
    justify-content: flex-end;
  }

  .finalize-button {
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid #1f4b99;
    background: #1f4b99;
    color: #fff;
  }

  .finalize-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
