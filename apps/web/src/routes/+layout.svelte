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
    DropdownItem,
    Indicator,
    uiHelpers,
  } from "flowbite-svelte";
  import {
    GridSolid,
    UsersSolid,
    BookOpenSolid,
    LandmarkSolid,
    BellSolid,
  } from "flowbite-svelte-icons";
  import { getNotifications, markNotificationRead } from "$lib/api/client";
  import "./layout.css";

  let { children } = $props();

  let session = $derived($authSession);
  let activeUrl = $derived(page.url.pathname);

  type NotificationItem = {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
  };

  let notifications = $state<NotificationItem[]>([]);
  let unreadCount = $derived(notifications.filter((n) => !n.isRead).length);

  const sidebarUi = uiHelpers();

  async function loadNotifications() {
    if (!session) return;
    try {
      const response = await getNotifications();
      notifications = response.notifications;
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      await markNotificationRead(id);
      notifications = notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
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

    if (session) {
      void loadNotifications();
    }
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
        <div class="relative mr-4 cursor-pointer" id="notification-bell">
          <BellSolid class="h-6 w-6 text-gray-500 dark:text-gray-400" />
          {#if unreadCount > 0}
            <Indicator
              color="red"
              size="sm"
              class="absolute -top-1 -right-1 border-2 border-white dark:border-gray-800"
              placement="top-right"
            />
          {/if}
        </div>
        <Dropdown
          placement="bottom"
          triggeredBy="#notification-bell"
          class="w-80 max-h-96 overflow-y-auto"
        >
          <DropdownHeader>
            <span class="block text-sm font-bold">Notifications</span>
          </DropdownHeader>
          {#if notifications.length === 0}
            <div class="p-4 text-center text-sm text-gray-500">
              No notifications yet.
            </div>
          {:else}
            {#each notifications as notification (notification.id)}
              <div
                class="flex flex-col p-3 border-b border-gray-100 dark:border-gray-700 last:border-0 {notification.isRead
                  ? 'bg-white dark:bg-gray-800'
                  : 'bg-blue-50/50 dark:bg-blue-900/20'}"
              >
                <div class="flex justify-between items-start">
                  <span class="text-xs font-bold text-gray-900 dark:text-white"
                    >{notification.title}</span
                  >
                  {#if !notification.isRead}
                    <button
                      class="text-[10px] text-blue-600 hover:underline"
                      onclick={() => handleMarkAsRead(notification.id)}
                    >
                      Mark as read
                    </button>
                  {/if}
                </div>
                <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {notification.message}
                </p>
                <span class="mt-1 text-[10px] text-gray-400">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </div>
            {/each}
          {/if}
        </Dropdown>
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
      isOpen={sidebarUi.isOpen}
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
            <SidebarItem label="Dashboard" href={resolve("/student")}>
              {#snippet icon()}
                <GridSolid
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
