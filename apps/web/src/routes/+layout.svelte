<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { clearAuthSession, authSession } from "$lib/stores/auth";
  import {
    Navbar,
    NavBrand,
    NavHamburger,
    Sidebar,
    SidebarWrapper,
    SidebarGroup,
    SidebarItem,
    Avatar,
    Dropdown,
    DropdownHeader,
    DropdownDivider,
    DropdownItem,
    uiHelpers,
  } from "flowbite-svelte";
  import {
    GridSolid,
    UsersSolid,
    BookOpenSolid,
    ChartPieSolid,
    LandmarkSolid,
  } from "flowbite-svelte-icons";
  import "./layout.css";

  let { children } = $props();

  let session = $derived($authSession);
  let activeUrl = $derived(page.url.pathname);

  const sidebarUi = uiHelpers();
  let isSidebarOpen = $state(false);

  $effect(() => {
    isSidebarOpen = sidebarUi.isOpen;
  });

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
    content="Client-only course enrollment dashboard powered by Flowbite-Svelte"
  />
</svelte:head>

<div class="antialiased bg-gray-50 dark:bg-gray-900">
  {#if session}
    <Navbar
      fluid
      class="fixed top-0 z-40 w-full border-b border-gray-200 dark:border-gray-700 bg-neutral-primary/90 backdrop-blur-sm"
    >
      <NavBrand href="/">
        <span
          class="self-center whitespace-nowrap text-xl font-semibold dark:text-white"
        >
          UniACES
        </span>
      </NavBrand>
      <div class="flex items-center md:order-2">
        <Avatar id="user-menu" src="" class="cursor-pointer" />
        <NavHamburger onclick={sidebarUi.toggle} class="md:hidden" />
      </div>
      <Dropdown placement="bottom" triggeredBy="#user-menu" class="min-w-max">
        <DropdownHeader>
          <span class="block text-sm font-bold">{session.user.name}</span>
          <span class="block text-sm font-medium">
            {session.user.role}
          </span>
        </DropdownHeader>
        <DropdownItem onclick={handleLogout}>Sign out</DropdownItem>
      </Dropdown>
    </Navbar>

    <Sidebar
      {activeUrl}
      isOpen={isSidebarOpen}
      closeSidebar={sidebarUi.close}
      class="fixed start-0 top-0 z-30 h-screen w-64 pt-16 transition-transform md:translate-x-0"
    >
      <SidebarWrapper>
        <SidebarGroup>
          {#if session.user.role === "admin"}
            <SidebarItem label="User Management" href={resolve("/admin/users")}>
              {#snippet icon()}
                <UsersSolid
                  class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />
              {/snippet}
            </SidebarItem>
            <SidebarItem
              label="Course Catalog"
              href={resolve("/admin/courses")}
            >
              {#snippet icon()}
                <BookOpenSolid
                  class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />
              {/snippet}
            </SidebarItem>
            <SidebarItem
              label="Section Scheduling"
              href={resolve("/admin/sections")}
            >
              {#snippet icon()}
                <LandmarkSolid
                  class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />
              {/snippet}
            </SidebarItem>
          {:else if session.user.role === "student"}
            <SidebarItem label="Enrollments" href={resolve("/student")}>
              {#snippet icon()}
                <GridSolid
                  class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />
              {/snippet}
            </SidebarItem>
            <SidebarItem label="Grade Sheets" href="#">
              {#snippet icon()}
                <ChartPieSolid
                  class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />
              {/snippet}
            </SidebarItem>
          {:else}
            <SidebarItem label="Grading Ledger" href={resolve("/instructor")}>
              {#snippet icon()}
                <GridSolid
                  class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />
              {/snippet}
            </SidebarItem>
          {/if}
        </SidebarGroup>
      </SidebarWrapper>
    </Sidebar>

    <main class="min-h-screen pt-16 md:ml-64">
      <div class="p-4">
        {@render children()}
      </div>
    </main>
  {:else}
    <main class="min-h-screen">
      {@render children()}
    </main>
  {/if}
</div>
