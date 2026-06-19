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
  class="h-full w-[380px] flex flex-col rounded-xl
         bg-background shadow-xl pointer-events-auto"
>
  <div class="px-4 py-2 border-b shrink-0">
    <span class="text-xs font-medium text-muted-foreground">
      {jobs.length} offre{jobs.length !== 1 ? "s" : ""}
    </span>
  </div>
  <div class="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {#each jobs as job (job.id)}
      <JobCard {job} active={job.id === activeJob?.id} {onHover} {onSelect} />
    {/each}
  </div>
</div>
