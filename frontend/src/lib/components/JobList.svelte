<script lang="ts">
  import type { Job, Skill } from "$lib/types";
  import { RefreshCw } from "@lucide/svelte";
  import JobCard from "./JobCard.svelte";

  let {
    jobs,
    skills = [],
    activeJob,
    selectedJobId = null,
    newResultsCount = 0,
    lastCheckedAt = null,
    loading = false,
    onShowNewResults,
    anchorKey = null,
    anchorJobId = null,
    onAnchorChange,
    onHover,
    onSelect,
    selectedJobIds,
    onToggleChecked,
  }: {
    jobs: Job[];
    skills?: Skill[];
    activeJob?: Job | null;
    selectedJobId?: string | null;
    newResultsCount?: number;
    lastCheckedAt?: string | null;
    loading?: boolean;
    onShowNewResults?: () => void;
    anchorKey?: string | null;
    anchorJobId?: string | null;
    onAnchorChange?: (jobId: string) => void;
    onHover?: (job: Job | null) => void;
    onSelect?: (job: Job) => void;
    selectedJobIds: Set<string>;
    onToggleChecked?: (jobId: string) => void;
  } = $props();

  let container = $state<HTMLDivElement | null>(null);
  let restoredFor: string | null = null;
  let lastReported: string | null = null;
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  function firstVisibleJobId(): string | null {
    if (!container) return null;
    const top = container.getBoundingClientRect().top;
    for (const el of container.querySelectorAll<HTMLElement>("[data-job-id]")) {
      if (el.getBoundingClientRect().bottom > top + 1) return el.dataset.jobId ?? null;
    }
    return null;
  }

  function handleScroll() {
    if (restoredFor !== anchorKey) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const id = firstVisibleJobId();
      if (!id || id === lastReported) return;
      lastReported = id;
      onAnchorChange?.(id);
    }, 400);
  }

  $effect(() => {
    const key = anchorKey;
    const target = anchorJobId;
    const count = jobs.length;
    if (!container || key === null || loading || restoredFor === key) return;
    lastReported = null;
    if (!target) {
      restoredFor = key;
      container.scrollTop = 0;
      return;
    }
    const el = container.querySelector(`[data-job-id="${CSS.escape(target)}"]`);
    if (el) {
      container.scrollTop +=
        el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      restoredFor = key;
      lastReported = target;
    } else if (count > 0) {
      restoredFor = key;
      container.scrollTop = 0;
    }
  });

  function formatLastChecked(iso: string): string {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div
  class="h-full w-full md:w-[480px] flex flex-col rounded-none md:rounded-xl
         bg-background shadow-panel pointer-events-auto"
>
  {#if newResultsCount > 0}
    <button
      onclick={() => onShowNewResults?.()}
      class="shrink-0 flex items-center justify-center gap-2 px-4 py-2 border-b
             bg-primary/10 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
    >
      <RefreshCw size={14} />
      {newResultsCount} nouveau{newResultsCount > 1 ? "x" : ""} résultat{newResultsCount > 1 ? "s" : ""}
    </button>
  {:else if lastCheckedAt}
    <div
      class="shrink-0 flex items-center justify-center gap-2 px-4 py-2 border-b
             text-xs text-muted-foreground"
    >
      Dernière mise à jour du flux : {formatLastChecked(lastCheckedAt)}
    </div>
  {/if}
  <div
    bind:this={container}
    onscroll={handleScroll}
    class="flex-1 overflow-y-auto pb-20 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {#each jobs as job (job.id)}
      <JobCard
        {job}
        {skills}
        active={job.id === activeJob?.id}
        selected={job.id === selectedJobId}
        checked={selectedJobIds.has(job.id)}
        {onHover}
        {onSelect}
        {onToggleChecked}
      />
    {/each}
  </div>
</div>
