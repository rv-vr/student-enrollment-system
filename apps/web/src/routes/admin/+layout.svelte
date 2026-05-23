<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";

  let { children } = $props();
  let session = $derived($authSession);

  $effect(() => {
    if (!session) return;

    if (session.user.role !== "admin") {
      const target = session.user.role === "instructor" ? "/instructor" : "/";
      void goto(resolve(target));
    }
  });
</script>

<div class="admin-shell">
  <header class="admin-header">
    <h2>Admin Dashboard</h2>
    <p class="muted">Administrative tools and system configuration.</p>
  </header>

  <main class="admin-content">
    {@render children()}
  </main>
</div>
