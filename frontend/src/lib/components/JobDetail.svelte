<script lang="ts">
  import type { Job } from "$lib/types";
  import { READABLE_SOURCES } from "$lib/types";

  let { job, onClose }: { job: Job; onClose?: () => void } = $props();

  const dateFormatted = new Date(job.datePosted).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
</script>

<div
  class="absolute top-1/2 -translate-y-1/2 left-[380px] w-[380px] h-1/2 z-20 flex flex-col bg-background/95 backdrop-blur border rounded-xl shadow-lg overflow-hidden"
>
  <div class="flex items-start justify-between gap-2 p-4 border-b">
    <div class="min-w-0">
      <h2 class="font-semibold text-base leading-tight truncate">
        {job.title}
      </h2>
      <p class="text-sm text-muted-foreground mt-0.5">
        {job.company}
        {#if job.establishment?.city}
          · {job.establishment.city}
        {:else}
          · {job.location}
        {/if}
      </p>
    </div>
    {#if onClose}
      <button
        onclick={onClose}
        class="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        aria-label="Fermer"
      >
        ✕
      </button>
    {/if}
  </div>

  <div
    class="flex items-center gap-2 px-4 py-2 border-b text-xs text-muted-foreground"
  >
    <span class="bg-muted rounded px-1.5 py-0.5"
      >{READABLE_SOURCES[job.source]}</span
    >
    <span>{dateFormatted}</span>
  </div>

  <div
    class="flex-1 overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {job.description}
  </div>

  <div class="p-4 border-t">
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      class="block w-full text-center bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
    >
      Voir l'offre →
    </a>
  </div>
</div>
