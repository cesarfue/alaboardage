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
</script>

<div
  class="absolute top-0 left-0 z-10 h-full w-[380px]
             p-3 flex flex-col gap-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
>
  {#each jobs as job (job.id)}
    <JobCard {job} active={job.id === activeId} {onHover} {onSelect} />
  {/each}
</div>
