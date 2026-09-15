<script lang="ts">
  import type { InteractionStatus, Job } from "$lib/types";
  import { READABLE_SOURCES } from "$lib/types";
  import { api } from "$lib/api";
  import { Bookmark, CheckCircle, XCircle } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  let {
    job,
    onClose,
    applyInteraction,
  }: {
    job: Job;
    onClose?: () => void;
    applyInteraction?: (jobId: string, status: InteractionStatus | undefined) => void;
  } = $props();

  const dateFormatted = $derived(
    new Date(job.datePosted).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );

  async function toggleStatus(status: InteractionStatus) {
    const isActive = job.interactionStatus === status;
    try {
      if (isActive) {
        await api.deleteInteraction(job.id);
        applyInteraction?.(job.id, undefined);
      } else {
        await api.setInteraction(job.id, status);
        applyInteraction?.(job.id, status);
      }
    } catch {
      toast.error("Impossible d'enregistrer cette action");
    }
  }
</script>

<div
  class="h-full w-[380px] flex flex-col pointer-events-auto bg-background/95 backdrop-blur border rounded-xl shadow-lg overflow-hidden"
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

  <div class="flex gap-2 p-4 border-t">
    <button
      onclick={() => toggleStatus("SAVED")}
      class="flex items-center gap-1.5 flex-1 justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors
        {job.interactionStatus === 'SAVED'
          ? 'bg-primary text-primary-foreground'
          : 'border hover:bg-muted'}"
      aria-label="Sauvegarder"
    >
      <Bookmark size={15} />
      Sauvegarder
    </button>
    <button
      onclick={() => toggleStatus("APPLIED")}
      class="flex items-center gap-1.5 flex-1 justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors
        {job.interactionStatus === 'APPLIED'
          ? 'bg-primary text-primary-foreground'
          : 'border hover:bg-muted'}"
      aria-label="Postulé"
    >
      <CheckCircle size={15} />
      Postulé
    </button>
    <button
      onclick={() => toggleStatus("REJECTED")}
      class="flex items-center gap-1.5 flex-1 justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors
        {job.interactionStatus === 'REJECTED'
          ? 'bg-primary text-primary-foreground'
          : 'border hover:bg-muted'}"
      aria-label="Refusé"
    >
      <XCircle size={15} />
      Refusé
    </button>
  </div>

  <div class="px-4 pb-4">
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
