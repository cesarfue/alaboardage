<script lang="ts">
  import type { Job } from "$lib/types";
  import JobCard from "./JobCard.svelte";

  let {
    jobs,
    activeJob,
    onHover,
    onSelect,
  }: {
    jobs: Job[];
    activeJob?: Job | null;
    onHover?: (job: Job | null) => void;
    onSelect?: (job: Job) => void;
  } = $props();
</script>

<div
  class="h-full w-[380px] flex flex-col overflow-y-auto rounded-xl
         bg-background shadow-xl pointer-events-auto
         [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
>
  {#each jobs as job (job.id)}
    <JobCard {job} active={job.id === activeJob?.id} {onHover} {onSelect} />
  {/each}
</div>
