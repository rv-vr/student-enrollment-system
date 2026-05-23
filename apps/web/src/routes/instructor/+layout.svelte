<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";

  let { children } = $props();

  let session = $derived($authSession);

  $effect(() => {
    // Block mount if user not instructor
    if (!session) return;

    if (session.user.role !== "instructor") {
      const target = session.user.role === "admin" ? "/admin" : "/";
      void goto(resolve(target));
    }
  });
</script>

<div class="instructor-shell">
  <header class="instructor-header">
    <h2>Instructor Dashboard</h2>
    <p class="muted">Manage your assigned courses and student rosters.</p>
  </header>

  <section class="instructor-content">
    {@render children()}
  </section>
</div>
