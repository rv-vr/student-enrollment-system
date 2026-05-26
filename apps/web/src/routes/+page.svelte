<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";

  let session = $derived($authSession);

  $effect(() => {
    if (!browser) {
      return;
    }

    const currentSession = session;

    if (!currentSession) {
      void goto(resolve("/login"));
      return;
    }

    if (currentSession.user.role === "admin") {
      void goto(resolve("/admin/users"));
      return;
    }

    if (currentSession.user.role === "student") {
      void goto(resolve("/student"));
      return;
    }

    void goto(resolve("/instructor"));
  });
</script>

<svelte:head>
  <title>Redirecting…</title>
</svelte:head>

<section class="routing-shell" aria-live="polite">
  <p>Redirecting to your dashboard…</p>
</section>

<style>
  .routing-shell {
    min-height: 45vh;
    display: grid;
    place-items: center;
    color: #516074;
  }
</style>
