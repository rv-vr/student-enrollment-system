<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { loginWithCredentials, ApiError } from "$lib/api/client";
  import { setAuthSession, authSession } from "$lib/stores/auth";
  import {
    Card,
    Button,
    Label,
    Input,
    Alert,
    Heading,
    P,
    Helper,
  } from "flowbite-svelte";
  import {
    InfoCircleSolid,
    EyeOutline,
    EyeSlashOutline,
    LockSolid,
  } from "flowbite-svelte-icons";

  let session = $derived($authSession);
  let username = $state("");
  let password = $state("");
  let showPassword = $state(false);
  let submitting = $state(false);
  let alertMessage = $state("");
  let alertTone = $state<"red" | "green" | "">("");

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
      alertTone = "green";

      const role = response.user?.role;
      const target =
        role === "admin"
          ? "/admin/users"
          : role === "student"
            ? "/student"
            : "/instructor";

      await goto(resolve(target));
    } catch (error) {
      const message =
        error instanceof ApiError && typeof error.payload.error === "string"
          ? error.payload.error
          : error instanceof Error
            ? error.message
            : "Unable to sign in.";

      alertMessage = message;
      alertTone = "red";
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Login | UniACES</title>
  <meta name="description" content="Sign in to the Course Enrollment System" />
</svelte:head>

<div
  class="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0 bg-gray-50 dark:bg-gray-900"
>
  <div
    class="flex items-center mb-6 text-2xl font-semibold text-gray-900 dark:text-white"
  >
    <LockSolid class="w-8 h-8 mr-2 text-primary-600" />
    UniACES
  </div>

  <Card class="w-full sm:max-w-md">
    <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
      <Heading
        tag="h1"
        class="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl dark:text-white"
      >
        Sign in to your account
      </Heading>

      <form class="space-y-4 md:space-y-6" onsubmit={handleLogin}>
        <div>
          <Label
            for="username"
            class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >Academic ID</Label
          >
          <Input
            type="text"
            name="username"
            id="username"
            bind:value={username}
            placeholder="2026-1842-A"
            required
            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 placeholder-slate-400/50"
          />
          <Helper class="mt-1 text-xs">Example: 2023-3292-I</Helper>
        </div>

        <div>
          <Label
            for="password"
            class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >Password</Label
          >
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            id="password"
            bind:value={password}
            placeholder="••••••••"
            required
            class="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 placeholder-slate-400/50"
          >
            {#snippet right()}
              <button
                type="button"
                onclick={() => (showPassword = !showPassword)}
                class="focus:outline-hidden"
              >
                {#if showPassword}
                  <EyeSlashOutline
                    class="w-5 h-5 text-gray-500 dark:text-gray-400"
                  />
                {:else}
                  <EyeOutline
                    class="w-5 h-5 text-gray-500 dark:text-gray-400"
                  />
                {/if}
              </button>
            {/snippet}
          </Input>
        </div>

        {#if alertMessage}
          <Alert
            color={alertTone === "red" ? "red" : "green"}
            dismissable={false}
          >
            {#snippet icon()}
              <InfoCircleSolid class="w-5 h-5" />
            {/snippet}
            <span class="font-medium">{alertMessage}</span>
          </Alert>
        {/if}

        <Button
          type="submit"
          loading={submitting}
          class="w-full text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:outline-hidden focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
        >
          Sign In
        </Button>

        {#if session}
          <P class="text-sm font-light text-gray-500 dark:text-gray-400">
            Already signed in as <span
              class="font-medium text-primary-600 dark:text-primary-500"
              >{session.user.name}</span
            >.
          </P>
        {/if}
      </form>
    </div>
  </Card>
</div>
