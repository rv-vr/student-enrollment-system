<script lang="ts">
	import { authSession } from '$lib/stores/auth'
	import { enrollStudent, getCourses } from '$lib/api/client'
	import type { CourseCatalogEntry } from '$lib/api/types'
	import { onMount } from 'svelte'

	let courses = $state<CourseCatalogEntry[]>([])
	let loading = $state(true)
	let savingCourseCode = $state<string | null>(null)
	let alertMessage = $state('')
	let alertTone = $state<'error' | 'success' | ''>('')
	let session = $derived($authSession)

	function showAlert(message: string, tone: 'error' | 'success') {
		alertMessage = message
		alertTone = tone
	}

	async function refreshCourses() {
		loading = true
		alertMessage = ''
		alertTone = ''

		try {
			courses = await getCourses()
		} catch (error) {
			showAlert(error instanceof Error ? error.message : 'Unable to load courses.', 'error')
		} finally {
			loading = false
		}
	}

	async function handleEnroll(courseCode: string) {
		if (!session) {
			showAlert('Sign in to enroll in a course.', 'error')
			return
		}

		savingCourseCode = courseCode
		alertMessage = ''
		alertTone = ''

		try {
			const response = await enrollStudent(session.user.id, courseCode)
			showAlert(response.message, 'success')
			courses = await getCourses()
		} catch (error) {
			showAlert(error instanceof Error ? error.message : 'Enrollment failed.', 'error')
		} finally {
			savingCourseCode = null
		}
	}

	onMount(() => {
		void refreshCourses()
	})
</script>

<svelte:head>
	<title>Course Catalog</title>
</svelte:head>

<section class="page-grid">
	<div class="panel">
		<div class="panel-header">
			<div>
				<p class="eyebrow">Course catalog</p>
				<h2>Available courses</h2>
				<p class="helper">
					{#if session}
						Logged in as <strong>{session.user.name}</strong> ({session.user.role}). Use the buttons below to
						enroll in the mock courses.
					{:else}
						Loading your authenticated session.
					{/if}
				</p>
			</div>
			<div class="meta">
				{courses.length} course{courses.length === 1 ? '' : 's'} available
			</div>
		</div>

		{#if alertMessage}
			<div class="banner" data-tone={alertTone} role="status" aria-live="polite">{alertMessage}</div>
		{/if}

		{#if loading}
			<div class="empty-state">
				<h2>Loading course catalog</h2>
				<p>Fetching the live catalog from the Hono API.</p>
			</div>
		{:else if courses.length === 0}
			<div class="empty-state">
				<h2>No courses available</h2>
				<p>The API returned an empty catalog.</p>
			</div>
		{:else}
			<div class="table-shell">
				<div class="table-scroll">
					<table>
						<thead>
							<tr>
								<th scope="col">Course Code</th>
								<th scope="col">Title</th>
								<th scope="col">Max Capacity</th>
								<th scope="col">Available Seats</th>
								<th scope="col">Status</th>
								<th scope="col">Action</th>
							</tr>
						</thead>
						<tbody>
							{#each courses as course (course.code)}
								<tr>
									<td class="course-code">{course.code}</td>
									<td>
										<div class="course-title">{course.title}</div>
										{#if course.prerequisiteCodes.length > 0}
											<p class="meta">Prerequisite: {course.prerequisiteCodes.join(', ')}</p>
										{/if}
									</td>
									<td>{course.capacity}</td>
									<td>{course.remainingSeats}</td>
									<td>
										<span class="pill" data-tone={course.remainingSeats > 0 ? 'good' : 'warn'}>
											{course.remainingSeats > 0 ? 'Open' : 'Full'}
										</span>
									</td>
									<td>
										<button
											type="button"
											onclick={() => handleEnroll(course.code)}
											disabled={savingCourseCode === course.code}
										>
											{savingCourseCode === course.code ? 'Enrolling…' : 'Enroll'}
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</section>
