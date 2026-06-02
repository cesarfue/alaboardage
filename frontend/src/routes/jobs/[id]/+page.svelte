<script lang="ts">
	import { page } from '$app/state'
	import { api } from '$lib/api'

	const id = $derived(page.params.id ?? '')
	let job = $state<Awaited<ReturnType<typeof api.getJob>> | null>(null)
	let error = $state<string | null>(null)

	$effect(() => {
		api.getJob(id)
			.then((j) => (job = j))
			.catch((e) => (error = String(e)))
	})
</script>

{#if error}
	<p>Erreur : {error}</p>
{:else if !job}
	<p>Chargement…</p>
{:else}
	<h1>{job.title}</h1>
	<p>{job.company} · {job.location}</p>
{/if}
