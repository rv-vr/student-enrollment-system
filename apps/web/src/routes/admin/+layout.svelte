<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authSession } from "$lib/stores/auth";

  let { children } = $props();
  let session = $derived($authSession);

  $effect(() => {
    if (!session) {
      void goto(resolve("/login"));
      return;
    }

    if (session.user.role !== "admin") {
      void goto(resolve("/login"));
    }
  });
</script>

<main class="admin-content">
  {@render children()}
</main>
