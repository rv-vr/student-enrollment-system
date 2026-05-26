<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";
  import {
    ApiError,
    createAdminUser,
    getAdminUsers,
    type AdminUser,
    type AdminUserCreatePayload,
  } from "$lib/api/client";

  type UserFormState = AdminUserCreatePayload;
  type NotificationState = {
    tone: "success" | "error";
    message: string;
  };

  const defaultForm = (): UserFormState => ({
    name: "",
    password: "",
    role: "student",
    college: "",
    program: "",
    campus: "",
  });

  function normalize(value: string) {
    return value.trim().toLowerCase();
  }

  function filterUsers(users: AdminUser[], query: string) {
    const term = normalize(query);

    if (!term) {
      return users;
    }

    return users.filter((user) => {
      return [
        user.name,
        user.username,
        user.role,
        user.college,
        user.program,
        user.campus,
      ]
        .filter((entry): entry is string => typeof entry === "string")
        .some((entry) => normalize(entry).includes(term));
    });
  }

  function toPublicError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return "Unauthorized access or validation failure.";
      }

      if (error.status === 500) {
        return "Unable to create the account right now. Try again later.";
      }

      if (
        typeof error.payload === "object" &&
        error.payload &&
        "error" in error.payload
      ) {
        const message = (error.payload as { error?: unknown }).error;

        if (typeof message === "string" && message.trim()) {
          return message;
        }
      }
    }

    return error instanceof Error ? error.message : "Unable to create account.";
  }

  let session = $derived($authSession);
  let form = $state<UserFormState>(defaultForm());
  let users = $state<AdminUser[]>([]);
  let createdUsers = $state<AdminUser[]>([]);
  let searchQuery = $state("");
  let isLoading = $state(false);
  let isFetching = $state(true);
  let feedback = $state<NotificationState | null>(null);
  let filteredUsers = $derived(filterUsers(users, searchQuery));
  let recentCreatedUsers = $derived(createdUsers.slice(0, 5));
  let showAcademicFields = $derived(form.role !== "admin");

  async function loadUsers() {
    isFetching = true;

    try {
      const response = await getAdminUsers();
      users = response.users ?? [];
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

    const name = form.name.trim();
    const password = form.password.trim();

    if (!name || !password) {
      feedback = {
        tone: "error",
        message: "Name and password are required.",
      };
      return;
    }

    isLoading = true;

    const payload: AdminUserCreatePayload = {
      name,
      password,
      role: form.role,
      ...(showAcademicFields && form.college.trim()
        ? { college: form.college.trim() }
        : {}),
      ...(showAcademicFields && form.program.trim()
        ? { program: form.program.trim() }
        : {}),
      ...(showAcademicFields && form.campus.trim()
        ? { campus: form.campus.trim() }
        : {}),
    };

    try {
      const response = await createAdminUser(payload);
      const createdUser = response.user;

      users = [createdUser, ...users];
      createdUsers = [createdUser, ...createdUsers];
      resetForm();
      feedback = {
        tone: "success",
        message: `Account Successfully Created! Assigned ID: ${createdUser.username}`,
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

  onMount(() => {
    const currentSession = session;

    if (!currentSession) {
      void goto(resolve("/login"));
      return;
    }

    if (currentSession.user.role !== "admin") {
      void goto(resolve("/login"));
      return;
    }

    void loadUsers();
  });
</script>

<svelte:head>
  <title>Admin User Management</title>
  <meta
    name="description"
    content="Provision and review admin-managed user accounts."
  />
</svelte:head>

<section class="admin-users-page">
  <header class="hero-card">
    <div>
      <p class="eyebrow">Milestone 3</p>
      <h1>Admin User Management</h1>
      <p class="lede">
        Provision student, instructor, and admin accounts, then review active
        users in one place.
      </p>
    </div>
    <div class="hero-stats">
      <div>
        <span class="stat-value">{users.length}</span>
        <span class="stat-label">Provisioned Accounts</span>
      </div>
      <div>
        <span class="stat-value">{createdUsers.length}</span>
        <span class="stat-label">Created This Session</span>
      </div>
    </div>
  </header>

  {#if feedback}
    <div
      class="feedback"
      data-tone={feedback.tone}
      role="alert"
      aria-live="assertive"
    >
      {feedback.message}
    </div>
  {/if}

  <div class="admin-grid">
    <section class="panel form-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Create New User Account</p>
          <h2>Provision account</h2>
        </div>
        <span class="panel-badge">Secure bcrypt flow</span>
      </div>

      <form class="provision-form" onsubmit={handleSubmit}>
        <div class="form-grid">
          <label>
            <span>Name</span>
            <input
              bind:value={form.name}
              autocomplete="name"
              placeholder="Alex Rivera"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              bind:value={form.password}
              autocomplete="new-password"
              placeholder="Create a strong password"
              required
              type="password"
            />
          </label>

          <label>
            <span>Role</span>
            <select bind:value={form.role}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        <div class="conditional-fields" data-active={showAcademicFields}>
          <div class="academic-grid">
            <label>
              <span>College</span>
              <input
                bind:value={form.college}
                autocomplete="organization"
                placeholder="College of Computing"
                disabled={!showAcademicFields}
              />
            </label>

            <label>
              <span>Program</span>
              <input
                bind:value={form.program}
                autocomplete="off"
                placeholder="BS Computer Science"
                disabled={!showAcademicFields}
              />
            </label>

            <label>
              <span>Campus</span>
              <input
                bind:value={form.campus}
                autocomplete="off"
                placeholder="Main Campus"
                disabled={!showAcademicFields}
              />
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Creating account…" : "Create account"}
          </button>
          <p class="helper-text">
            {showAcademicFields
              ? "Academic users may include college, program, and campus details."
              : "Admin accounts skip academic profile fields."}
          </p>
        </div>
      </form>
    </section>

    <section class="panel list-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Currently Provisioned</p>
          <h2>Search accounts</h2>
        </div>
        <label class="search-box">
          <span class="sr-only">Search provisioned users</span>
          <input
            bind:value={searchQuery}
            placeholder="Search name, ID, role…"
          />
        </label>
      </div>

      {#if isFetching}
        <div class="empty-state">Loading user directory…</div>
      {:else if filteredUsers.length === 0}
        <div class="empty-state">No users match the current search.</div>
      {:else}
        <div
          class="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm"
        >
          <table
            class="w-full min-w-[600px] border-collapse text-left text-sm text-slate-500"
          >
            <thead>
              <tr>
                <th class="whitespace-nowrap">Name</th>
                <th class="whitespace-nowrap">Username</th>
                <th class="whitespace-nowrap">Role</th>
                <th class="whitespace-nowrap">Academic Profile</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredUsers as user (user.id)}
                <tr>
                  <td>
                    <div class="primary-cell max-w-[200px] truncate">
                      {user.name}
                    </div>
                    <div class="secondary-cell whitespace-nowrap">
                      {user.id}
                    </div>
                  </td>
                  <td class="whitespace-nowrap">
                    <span class="username-pill">{user.username}</span>
                  </td>
                  <td class="whitespace-nowrap">
                    <span class="role-pill" data-role={user.role}
                      >{user.role}</span
                    >
                  </td>
                  <td>
                    <div class="profile-stack">
                      <span class="max-w-[200px] truncate"
                        >{user.college ?? "-"}</span
                      >
                      <span class="max-w-[200px] truncate"
                        >{user.program ?? "-"}</span
                      >
                      <span class="max-w-[200px] truncate"
                        >{user.campus ?? "-"}</span
                      >
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </div>

  <section class="panel history-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Session History</p>
        <h2>Recently Created Accounts</h2>
      </div>
    </div>

    {#if recentCreatedUsers.length === 0}
      <div class="empty-state">
        No accounts have been created during this session.
      </div>
    {:else}
      <div class="history-grid">
        {#each recentCreatedUsers as user (user.id)}
          <article class="history-card">
            <div class="history-top">
              <strong>{user.name}</strong>
              <span class="role-pill" data-role={user.role}>{user.role}</span>
            </div>
            <div class="history-username">{user.username}</div>
            <div class="history-meta">
              <span>{user.college ?? "No college"}</span>
              <span>{user.program ?? "No program"}</span>
              <span>{user.campus ?? "No campus"}</span>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</section>

<style>
  .admin-users-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 1.5rem;
    color: var(--text, #eef2ff);
  }

  .hero-card,
  .panel {
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 1.5rem;
    background: linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.92),
      rgba(3, 7, 18, 0.92)
    );
    box-shadow: 0 24px 60px rgba(2, 6, 23, 0.35);
    backdrop-filter: blur(16px);
  }

  .hero-card {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .hero-card h1,
  .panel h2 {
    margin: 0.35rem 0 0;
    font-size: clamp(1.55rem, 3vw, 2.4rem);
  }

  .eyebrow {
    margin: 0;
    font-size: 0.76rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #67e8f9;
    font-weight: 700;
  }

  .lede {
    max-width: 62ch;
    color: rgba(226, 232, 240, 0.78);
    margin: 0.65rem 0 0;
    line-height: 1.55;
  }

  .hero-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(120px, 1fr));
    gap: 0.75rem;
    min-width: 280px;
  }

  .hero-stats > div {
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.16);
  }

  .stat-value {
    display: block;
    font-size: 1.6rem;
    font-weight: 800;
    color: #f8fafc;
  }

  .stat-label {
    display: block;
    margin-top: 0.25rem;
    color: rgba(226, 232, 240, 0.7);
    font-size: 0.86rem;
  }

  .feedback {
    margin: 0 0 1rem;
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    font-weight: 600;
    border: 1px solid transparent;
  }

  .feedback[data-tone="success"] {
    background: rgba(34, 197, 94, 0.14);
    border-color: rgba(34, 197, 94, 0.35);
    color: #bbf7d0;
  }

  .feedback[data-tone="error"] {
    background: rgba(244, 63, 94, 0.14);
    border-color: rgba(244, 63, 94, 0.35);
    color: #fecdd3;
  }

  .admin-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    align-items: stretch;
    margin-bottom: 1rem;
  }

  .panel {
    padding: 1.25rem;
  }

  .panel-heading {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
    margin-bottom: 1rem;
  }

  .panel-badge {
    padding: 0.45rem 0.75rem;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.12);
    color: #bae6fd;
    border: 1px solid rgba(14, 165, 233, 0.24);
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .provision-form {
    display: grid;
    gap: 1.25rem;
  }

  .form-grid,
  .academic-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .provision-form label,
  .search-box {
    display: grid;
    gap: 0.45rem;
  }

  .provision-form span,
  .search-box span {
    font-size: 0.86rem;
    color: rgba(226, 232, 240, 0.82);
    font-weight: 600;
  }

  .provision-form input,
  .provision-form select,
  .search-box input {
    width: 100%;
    border-radius: 0.95rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.88);
    color: var(--text, #eef2ff);
    padding: 0.85rem 0.95rem;
  }

  .provision-form input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .conditional-fields {
    display: grid;
    gap: 0.85rem;
    padding: 0.95rem;
    border-radius: 1rem;
    border: 1px dashed rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.38);
  }

  .conditional-fields[data-active="false"] {
    opacity: 0.65;
  }

  .form-actions {
    display: grid;
    gap: 0.75rem;
  }

  .form-actions button {
    border: 0;
    border-radius: 0.95rem;
    padding: 0.95rem 1.15rem;
    font-weight: 800;
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #08111f;
    cursor: pointer;
  }

  .form-actions button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .helper-text {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(226, 232, 240, 0.7);
    line-height: 1.5;
  }

  .list-panel .panel-heading {
    align-items: center;
  }

  .search-box {
    min-width: min(100%, 280px);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 740px;
  }

  thead {
    background: rgba(15, 23, 42, 0.95);
  }

  th,
  td {
    padding: 0.9rem 1rem;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  th {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(226, 232, 240, 0.72);
  }

  .primary-cell {
    font-weight: 700;
    color: #f8fafc;
  }

  .secondary-cell {
    margin-top: 0.25rem;
    font-size: 0.82rem;
    color: rgba(226, 232, 240, 0.55);
    word-break: break-all;
  }

  .username-pill,
  .role-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.38rem 0.7rem;
    font-size: 0.82rem;
    font-weight: 700;
    border: 1px solid rgba(148, 163, 184, 0.18);
  }

  .username-pill {
    background: rgba(56, 189, 248, 0.12);
    color: #bae6fd;
  }

  .role-pill[data-role="student"] {
    background: rgba(96, 165, 250, 0.12);
    color: #bfdbfe;
  }

  .role-pill[data-role="instructor"] {
    background: rgba(168, 85, 247, 0.12);
    color: #e9d5ff;
  }

  .role-pill[data-role="admin"] {
    background: rgba(251, 191, 36, 0.12);
    color: #fde68a;
  }

  .profile-stack,
  .history-meta {
    display: grid;
    gap: 0.2rem;
    color: rgba(226, 232, 240, 0.76);
    font-size: 0.86rem;
  }

  .history-panel {
    margin-bottom: 0.5rem;
  }

  .history-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.85rem;
  }

  .history-card {
    padding: 1rem;
    border-radius: 1rem;
    background: rgba(15, 23, 42, 0.78);
    border: 1px solid rgba(148, 163, 184, 0.14);
  }

  .history-top {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .history-top strong {
    color: #f8fafc;
  }

  .history-username {
    margin: 0.65rem 0;
    color: #7dd3fc;
    font-weight: 700;
    word-break: break-word;
  }

  .empty-state {
    padding: 1rem;
    border-radius: 1rem;
    background: rgba(15, 23, 42, 0.64);
    color: rgba(226, 232, 240, 0.72);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 900px) {
    .hero-card,
    .panel-heading {
      flex-direction: column;
    }

    .hero-stats,
    .admin-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
