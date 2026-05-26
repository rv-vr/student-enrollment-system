<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { clearAuthSession, authSession } from "$lib/stores/auth";
  import "./layout.css";

  let { children } = $props();

  let session = $derived($authSession);

  function getRoleHome(role: string) {
    if (role === "admin") {
      return "/admin/users";
    }

    if (role === "student") {
      return "/student";
    }

    return "/instructor";
  }

  $effect(() => {
    if (!browser) {
      return;
    }

    const pathname = page.url.pathname;

    if (!session && pathname !== "/login") {
      void goto(resolve("/login"));
    } else if (session && pathname === "/login") {
      void goto(resolve(getRoleHome(session.user.role)));
    }
  });

  function handleLogout() {
    clearAuthSession();
    void goto(resolve("/login"));
  }
</script>

<svelte:head>
  <title>Course Enrollment System</title>
  <meta
    name="description"
    content="Client-only course enrollment dashboard powered by Hono RPC"
  />
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <div class="brand-block">
      <p class="eyebrow">Course Enrollment System</p>
      <h1>Enrollment Portal</h1>
    </div>

    {#if session}
      {#if session.user.role === "admin"}
        <nav aria-label="Primary navigation" class="nav-links desktop-nav">
          <a
            href={resolve("/admin/users")}
            aria-current={page.url.pathname.startsWith("/admin/users")
              ? "page"
              : undefined}
          >
            User Management
          </a>
          <a
            href={resolve("/admin/courses")}
            aria-current={page.url.pathname.startsWith("/admin/courses")
              ? "page"
              : undefined}
          >
            Course Catalog
          </a>
          <a
            href={resolve("/admin/sections")}
            aria-current={page.url.pathname.startsWith("/admin/sections")
              ? "page"
              : undefined}
          >
            Section Scheduling
          </a>
        </nav>

        <nav aria-label="Primary navigation" class="nav-links mobile-nav">
          <a
            href={resolve("/admin/users")}
            aria-current={page.url.pathname.startsWith("/admin/users")
              ? "page"
              : undefined}
          >
            User Management
          </a>
          <a
            href={resolve("/admin/courses")}
            aria-current={page.url.pathname.startsWith("/admin/courses")
              ? "page"
              : undefined}
          >
            Course Catalog
          </a>
          <a
            href={resolve("/admin/sections")}
            aria-current={page.url.pathname.startsWith("/admin/sections")
              ? "page"
              : undefined}
          >
            Section Scheduling
          </a>
        </nav>
      {:else if session.user.role === "student"}
        <nav aria-label="Primary navigation" class="nav-links desktop-nav">
          <a
            href={resolve("/student")}
            aria-current={page.url.pathname.startsWith("/student")
              ? "page"
              : undefined}
          >
            My Enrollment Portal
          </a>
        </nav>

        <nav aria-label="Primary navigation" class="nav-links mobile-nav">
          <a
            href={resolve("/student")}
            aria-current={page.url.pathname.startsWith("/student")
              ? "page"
              : undefined}
          >
            My Enrollment Portal
          </a>
        </nav>
      {:else}
        <nav aria-label="Primary navigation" class="nav-links desktop-nav">
          <a
            href={resolve("/instructor")}
            aria-current={page.url.pathname.startsWith("/instructor")
              ? "page"
              : undefined}
          >
            Faculty Grading Ledger
          </a>
        </nav>

        <nav aria-label="Primary navigation" class="nav-links mobile-nav">
          <a
            href={resolve("/instructor")}
            aria-current={page.url.pathname.startsWith("/instructor")
              ? "page"
              : undefined}
          >
            Faculty Grading Ledger
          </a>
        </nav>
      {/if}

      <button type="button" class="logout-button" onclick={handleLogout}>
        Logout
      </button>
    {:else}
      <button
        type="button"
        class="login-button"
        onclick={() => goto(resolve("/login"))}
      >
        Login
      </button>
    {/if}
  </header>

  <main>
    {@render children()}
  </main>
</div>
