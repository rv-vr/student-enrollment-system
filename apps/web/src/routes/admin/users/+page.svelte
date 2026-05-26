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
    Search,
    Alert,
  } from "flowbite-svelte";

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

<section class="admin-users-page space-y-6">
  <Card size="xl" class="shadow-none border-slate-200 max-w-none p-4">
    <div class="flex flex-col md:flex-row justify-between gap-6">
      <div>
        <Heading tag="h1" class="text-2xl font-bold"
          >Admin User Management</Heading
        >
        <P class="lede mt-2">
          Provision student, instructor, and admin accounts, then review active
          users in one place.
        </P>
      </div>
      <div class="hero-stats flex gap-4">
        <Card
          size="sm"
          class="shadow-none border-slate-200 bg-gray-50/50 dark:bg-gray-800/50 p-2"
        >
          <span
            class="stat-value text-2xl font-bold text-gray-900 dark:text-white"
            >{users.length}</span
          >
          <span class="stat-label text-sm text-gray-500 dark:text-gray-400"
            >Provisioned Accounts</span
          >
        </Card>
        <Card
          size="sm"
          class="shadow-none border-slate-200 bg-gray-50/50 dark:bg-gray-800/50 p-2"
        >
          <span
            class="stat-value text-2xl font-bold text-gray-900 dark:text-white"
            >{createdUsers.length}</span
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
          <p class="eyebrow">Create New User Account</p>
          <Heading tag="h2" class="text-xl font-bold">Provision account</Heading
          >
        </div>
      </div>

      <form class="provision-form" onsubmit={handleSubmit}>
        <div class="form-grid grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label for="name" class="mb-2">Name</Label>
            <Input
              id="name"
              bind:value={form.name}
              autocomplete="name"
              placeholder="Alex Rivera"
              class="placeholder-slate-400/50"
              required
            />
          </div>

          <div>
            <Label for="password" class="mb-2">Password</Label>
            <Input
              id="password"
              bind:value={form.password}
              autocomplete="new-password"
              placeholder="Create a strong password"
              class="placeholder-slate-400/50"
              required
              type="password"
            />
          </div>

          <div>
            <Label for="role" class="mb-2">Role</Label>
            <Select id="role" bind:value={form.role}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
        </div>

        <div class="conditional-fields mt-6" data-active={showAcademicFields}>
          <div class="academic-grid grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label for="college" class="mb-2">College</Label>
              <Input
                id="college"
                bind:value={form.college}
                autocomplete="organization"
                placeholder="College of Computing"
                disabled={!showAcademicFields}
                class="placeholder-slate-400/50"
              />
            </div>

            <div>
              <Label for="program" class="mb-2">Program</Label>
              <Input
                id="program"
                bind:value={form.program}
                autocomplete="off"
                placeholder="BS Computer Science"
                disabled={!showAcademicFields}
                class="placeholder-slate-400/50"
              />
            </div>

            <div>
              <Label for="campus" class="mb-2">Campus</Label>
              <Input
                id="campus"
                bind:value={form.campus}
                autocomplete="off"
                placeholder="Main Campus"
                disabled={!showAcademicFields}
                class="placeholder-slate-400/50"
              />
            </div>
          </div>
        </div>

        <div
          class="form-actions mt-8 flex flex-col md:flex-row items-center gap-4"
        >
          <Button type="submit" disabled={isLoading} class="w-full md:w-auto">
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
          <P size="sm" class="helper-text text-gray-500 dark:text-gray-400">
            {showAcademicFields
              ? "Academic users may include college, program, and campus details."
              : "Admin accounts skip academic profile fields."}
          </P>
        </div>
      </form>
    </Card>

    <Card size="xl" class="shadow-none border-slate-200 max-w-none p-4">
      <div
        class="panel-heading mb-6 flex flex-col md:flex-row justify-between items-center gap-4"
      >
        <div>
          <p class="eyebrow">Currently Provisioned</p>
          <Heading tag="h2" class="text-xl font-bold">Search accounts</Heading>
        </div>
        <div class="search-box w-full md:w-80">
          <Search
            bind:value={searchQuery}
            placeholder="Search name, ID, role…"
            size="md"
          />
        </div>
      </div>

      {#if isFetching}
        <div class="empty-state py-8 text-center text-gray-500">
          Loading user directory…
        </div>
      {:else if filteredUsers.length === 0}
        <div class="empty-state py-8 text-center text-gray-500">
          No users match the current search.
        </div>
      {:else}
        <Table
          hoverable={true}
          class="mt-4 shadow-none border border-slate-200 rounded-lg overflow-hidden"
        >
          <TableHead class="bg-gray-50 dark:bg-gray-800">
            <TableHeadCell>Name</TableHeadCell>
            <TableHeadCell>Username</TableHeadCell>
            <TableHeadCell>Role</TableHeadCell>
            <TableHeadCell>Academic Profile</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each filteredUsers as user (user.id)}
              <TableBodyRow>
                <TableBodyCell>
                  <div
                    class="primary-cell font-bold text-gray-900 dark:text-white truncate max-w-[200px]"
                  >
                    {user.name}
                  </div>
                  <div
                    class="secondary-cell text-xs text-gray-500 dark:text-gray-400 truncate"
                  >
                    {user.id}
                  </div>
                </TableBodyCell>
                <TableBodyCell>
                  <Badge color="blue" class="rounded-full px-2 py-0.5"
                    >{user.username}</Badge
                  >
                </TableBodyCell>
                <TableBodyCell>
                  <Badge
                    color={user.role === "admin"
                      ? "yellow"
                      : user.role === "instructor"
                        ? "purple"
                        : "blue"}
                    class="rounded-full px-2 py-0.5"
                  >
                    {user.role}
                  </Badge>
                </TableBodyCell>
                <TableBodyCell>
                  <div
                    class="profile-stack text-sm text-gray-500 dark:text-gray-400 space-y-1"
                  >
                    <div class="truncate max-w-[200px]">
                      {user.college ?? "-"}
                    </div>
                    <div class="truncate max-w-[200px]">
                      {user.program ?? "-"}
                    </div>
                    <div class="truncate max-w-[200px]">
                      {user.campus ?? "-"}
                    </div>
                  </div>
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </Card>
  </div>

  <Card size="xl" class="shadow-none border-slate-200 max-w-none p-4">
    <div class="panel-heading mb-6">
      <p class="eyebrow">Session History</p>
      <Heading tag="h2" class="text-xl font-bold"
        >Recently Created Accounts</Heading
      >
    </div>

    {#if recentCreatedUsers.length === 0}
      <div class="empty-state py-8 text-center text-gray-500">
        No accounts have been created during this session.
      </div>
    {:else}
      <div
        class="history-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {#each recentCreatedUsers as user (user.id)}
          <Card size="md" class="shadow-none border-slate-200 bg-gray-50/30">
            <div class="history-top flex justify-between items-start mb-3">
              <strong class="text-gray-900 dark:text-white">{user.name}</strong>
              <Badge
                color={user.role === "admin"
                  ? "yellow"
                  : user.role === "instructor"
                    ? "purple"
                    : "blue"}
                class="rounded-full"
              >
                {user.role}
              </Badge>
            </div>
            <div
              class="history-username text-primary-600 font-bold mb-3 break-all"
            >
              {user.username}
            </div>
            <div
              class="history-meta text-sm text-gray-500 dark:text-gray-400 space-y-1"
            >
              <div>{user.college ?? "No college"}</div>
              <div>{user.program ?? "No program"}</div>
              <div>{user.campus ?? "No campus"}</div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </Card>
</section>

<style>
  .admin-users-page {
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
