<script lang="ts">
  import type { Job } from "$lib/types";
  import JobCard from "./JobCard.svelte";

  let {
    jobs,
    activeId = null,
    onHover,
    onSelect,
  }: {
    jobs: Job[];
    activeId?: string | null;
    onHover?: (id: string | null) => void;
    onSelect?: (id: string) => void;
  } = $props();

  // TODO: scroll-into-view de la carte active quand activeId change
  // (clic sur un pin de la map → faire remonter la JobCard correspondante)
</script>

<div class="job-list">
  {#each jobs as job (job.id)}
    <JobCard {job} active={job.id === activeId} {onHover} {onSelect} />
  {/each}
</div>
