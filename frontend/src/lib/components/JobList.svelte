<script lang="ts">
  import type { InteractionStatus, Job, Skill } from "$lib/types";
  import JobCard from "./JobCard.svelte";

  let {
    jobs,
    skills = [],
    activeJob,
    statusFilter = $bindable(null),
    onHover,
    onSelect,
  }: {
    jobs: Job[];
    skills?: Skill[];
    activeJob?: Job | null;
    statusFilter?: InteractionStatus | null;
    onHover?: (job: Job | null) => void;
    onSelect?: (job: Job) => void;
  } = $props();

  const chips: { label: string; value: InteractionStatus | null }[] = [
    { label: "Tout", value: null },
    { label: "Sauvegardé", value: "SAVED" },
    { label: "Postulé", value: "APPLIED" },
    { label: "Refusé", value: "REJECTED" },
  ];
</script>

<div
  class="h-full w-[380px] flex flex-col rounded-xl
         bg-background shadow-xl pointer-events-auto"
>
  <div class="px-4 pt-3 pb-2 border-b shrink-0 flex flex-col gap-2">
    <div class="flex gap-1.5 flex-wrap">
      {#each chips as chip (chip.value)}
        <button
          class="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors
            {statusFilter === chip.value
              ? 'bg-primary text-primary-foreground'
              : 'border hover:bg-muted text-muted-foreground'}"
          onclick={() => (statusFilter = chip.value)}
        >
          {chip.label}
        </button>
      {/each}
    </div>
    <span class="text-xs font-medium text-muted-foreground">
      {jobs.length} offre{jobs.length !== 1 ? "s" : ""}
    </span>
  </div>
  <div class="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {#each jobs as job (job.id)}
      <JobCard {job} {skills} active={job.id === activeJob?.id} {onHover} {onSelect} />
    {/each}
  </div>
</div>
