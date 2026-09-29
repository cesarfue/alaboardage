<script lang="ts">
  import type { InteractionStatus, Job, RefreshState, Skill } from "$lib/types";
  import { RefreshCw } from "@lucide/svelte";
  import JobCard from "./JobCard.svelte";

  let {
    jobs,
    skills = [],
    activeJob,
    selectedJobId = null,
    showChips = false,
    newResultsCount = 0,
    loading = false,
    refreshState = "idle",
    onShowNewResults,
    onRequestRefresh,
    statusFilter = $bindable(null),
    anchorKey = null,
    anchorJobId = null,
    onAnchorChange,
    onHover,
    onSelect,
  }: {
    jobs: Job[];
    skills?: Skill[];
    activeJob?: Job | null;
    selectedJobId?: string | null;
    showChips?: boolean;
    newResultsCount?: number;
    loading?: boolean;
    refreshState?: RefreshState;
    onShowNewResults?: () => void;
    onRequestRefresh?: () => void;
    statusFilter?: InteractionStatus | null;
    anchorKey?: string | null;
    anchorJobId?: string | null;
    onAnchorChange?: (jobId: string) => void;
    onHover?: (job: Job | null) => void;
    onSelect?: (job: Job) => void;
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

  const chips: { label: string; value: InteractionStatus | null }[] = [
    { label: "Tout", value: null },
    { label: "Sauvegardé", value: "SAVED" },
    { label: "Postulé", value: "APPLIED" },
    { label: "Refusé", value: "REJECTED" },
  ];
</script>

<div
  class="h-full w-full md:w-[380px] flex flex-col rounded-none md:rounded-xl
         bg-background shadow-panel pointer-events-auto"
>
  <div class="px-4 pt-3 pb-2 border-b shrink-0 flex flex-col gap-2">
    {#if showChips}
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
    {/if}
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-muted-foreground">
        {loading ? "Chargement…" : `${jobs.length} offre${jobs.length !== 1 ? "s" : ""}`}
      </span>
      {#if onRequestRefresh}
        <button
          onclick={() => onRequestRefresh?.()}
          disabled={refreshState !== "idle"}
          class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground
                 disabled:cursor-not-allowed disabled:opacity-100"
        >
          <RefreshCw
            size={13}
            class={refreshState === "running" ? "animate-spin" : ""}
          />
          {refreshState === "running"
            ? "Scraping en cours…"
            : refreshState === "queued"
              ? "En file d'attente"
              : "Relancer le scraping"}
        </button>
      {/if}
    </div>
  </div>
  {#if newResultsCount > 0}
    <button
      onclick={() => onShowNewResults?.()}
      class="shrink-0 flex items-center justify-center gap-2 px-4 py-2 border-b
             bg-primary/10 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
    >
      <RefreshCw size={14} />
      {newResultsCount} nouveau{newResultsCount > 1 ? "x" : ""} résultat{newResultsCount > 1 ? "s" : ""}
    </button>
  {/if}
  <div
    bind:this={container}
    onscroll={handleScroll}
    class="flex-1 overflow-y-auto pb-20 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {#each jobs as job (job.id)}
      <JobCard {job} {skills} active={job.id === activeJob?.id} selected={job.id === selectedJobId} {onHover} {onSelect} />
    {/each}
  </div>
</div>
