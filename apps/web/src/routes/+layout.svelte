<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { clearAuthSession, authSession } from "$lib/stores/auth";
  import "./layout.css";

  let { children } = $props();

  let session = $derived($authSession);

  $effect(() => {
    if (!browser) {
      return;
    }

    const pathname = page.url.pathname;

    if (!session && pathname !== "/login") {
      void goto(resolve("/login"));
    } else if (session && pathname === "/login") {
      // Redirect authenticated users to their role-specific home
      const role = session.user?.role;
      const target =
        role === "admin"
          ? "/admin"
          : role === "instructor"
            ? "/instructor"
            : "/";
      void goto(resolve(target));
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
      <p class="subcopy">
        Manage the mock catalog without leaving the browser.
      </p>
    </div>

    {#if session && session.user.role === "student"}
      <nav aria-label="Primary navigation" class="nav-links">
        <a
          href={resolve("/")}
          aria-current={page.url.pathname === "/" ? "page" : undefined}
          >My Courses</a
        >
        <a
          href={resolve("/courses")}
          aria-current={page.url.pathname.startsWith("/courses")
            ? "page"
            : undefined}
        >
          Available Courses
        </a>
      </nav>

      <div class="session-readout" aria-label="Authenticated user">
        <span>Logged in as</span>
        <strong>{session.user.name} ({session.user.role})</strong>
      </div>

      <button type="button" class="logout-button" onclick={handleLogout}
        >Log Out</button
      >
    {:else if session && session.user.role === "instructor"}
      <nav aria-label="Instructor navigation" class="nav-links">
        <a
          href={resolve("/instructor")}
          aria-current={page.url.pathname.startsWith("/instructor")
            ? "page"
            : undefined}>Instructor Dashboard</a
        >
      </nav>

      <div class="session-readout" aria-label="Authenticated user">
        <span>Logged in as</span>
        <strong>{session.user.name} ({session.user.role})</strong>
      </div>

      <button type="button" class="logout-button" onclick={handleLogout}
        >Log Out</button
      >
    {:else if session && session.user.role === "admin"}
      <nav aria-label="Admin navigation" class="nav-links">
        <a
          href={resolve("/admin")}
          aria-current={page.url.pathname.startsWith("/admin") &&
          !page.url.pathname.startsWith("/admin/users")
            ? "page"
            : undefined}>Admin Dashboard</a
        >
        <a
          href={resolve("/admin/users")}
          aria-current={page.url.pathname.startsWith("/admin/users")
            ? "page"
            : undefined}>User Management</a
        >
        <a
          href={resolve("/admin/sections")}
          aria-current={page.url.pathname.startsWith("/admin/sections")
            ? "page"
            : undefined}>Section Management</a
        >
        <a
          href={resolve("/admin/courses")}
          aria-current={page.url.pathname.startsWith("/admin/courses")
            ? "page"
            : undefined}>Course Catalog</a
        >
      </nav>

      <div class="session-readout" aria-label="Authenticated user">
        <span>Logged in as</span>
        <strong>{session.user.name} ({session.user.role})</strong>
      </div>

      <button type="button" class="logout-button" onclick={handleLogout}
        >Log Out</button
      >
    {/if}
  </header>

  <main>
    {@render children()}
  </main>
</div>
