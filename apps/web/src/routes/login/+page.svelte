<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { loginWithCredentials, ApiError } from "$lib/api/client";
  import { setAuthSession, authSession } from "$lib/stores/auth";

  let session = $derived($authSession);
  let username = $state("");
  let password = $state("");
  let showPassword = $state(false);
  let submitting = $state(false);
  let alertMessage = $state("");
  let alertTone = $state<"error" | "success" | "">("");

  async function handleLogin(event: SubmitEvent) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    submitting = true;
    alertMessage = "";
    alertTone = "";

    try {
      const response = await loginWithCredentials(username.trim(), password);
      setAuthSession({ token: response.token, user: response.user });
      alertMessage = "Signed in successfully.";
      alertTone = "success";

      // Redirect based on role returned from the login response
      const role = response.user?.role;
      const target =
        role === "admin"
          ? "/admin"
          : role === "instructor"
            ? "/instructor"
            : "/";

      await goto(resolve(target));
    } catch (error) {
      const message =
        error instanceof ApiError && typeof error.payload.error === "string"
          ? error.payload.error
          : error instanceof Error
            ? error.message
            : "Unable to sign in.";

      alertMessage = message;
      alertTone = "error";
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Login</title>
  <meta name="description" content="Sign in to the Course Enrollment System" />
</svelte:head>

<section class="login-shell">
  <div class="login-panel">
    <p class="eyebrow">Authentication required</p>
    <h2>Sign in</h2>
    <p>Use your actor ID and last name to access the mock enrollment portal.</p>

    {#if alertMessage}
      <div
        class="banner"
        data-tone={alertTone}
        role="alert"
        aria-live="assertive"
      >
        {alertMessage}
      </div>
    {/if}

    <form class="login-form" onsubmit={handleLogin}>
      <label>
        <span>User ID</span>
        <input
          autocomplete="username"
          autocapitalize="characters"
          bind:value={username}
          name="username"
          placeholder="2026-1842-A"
          required
          spellcheck="false"
        />
      </label>

      <label>
        <span>Password</span>
        <div class="password-field">
          <input
            autocomplete="current-password"
            bind:value={password}
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Patel"
            required
          />
          <button
            class="password-toggle"
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onclick={() => (showPassword = !showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <div class="login-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign In"}
        </button>
        {#if session}
          <p class="helper">
            Already signed in as <strong>{session.user.name}</strong>.
          </p>
        {/if}
      </div>
    </form>
  </div>
</section>
