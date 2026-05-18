<script lang="ts">
	import { page } from '$app/state'
	import { activeStudentId, getStudentName, students } from '$lib/stores/student'
	import './layout.css'

	let { children } = $props()

	function handleStudentChange(event: Event) {
		const target = event.currentTarget as HTMLSelectElement
		activeStudentId.set(Number(target.value))
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
			<p class="subcopy">Manage the mock catalog without leaving the browser.</p>
		</div>

		<nav aria-label="Primary navigation" class="nav-links">
			<a href="/" aria-current={page.url.pathname === '/' ? 'page' : undefined}>Courses</a>
			<a href="/my-courses" aria-current={page.url.pathname.startsWith('/my-courses') ? 'page' : undefined}>
				My Courses
			</a>
		</nav>

		<label class="student-switcher" for="student-select">
			<span>Acting as</span>
			<select id="student-select" value={$activeStudentId} onchange={handleStudentChange}>
				{#each students as student (student.id)}
					<option value={student.id}>{student.name}</option>
				{/each}
			</select>
			<strong>{getStudentName($activeStudentId)}</strong>
		</label>
	</header>

	<main>
		{@render children()}
	</main>
</div>
