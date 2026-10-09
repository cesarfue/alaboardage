<script lang="ts">
  import type { InteractionStatus, Job } from "$lib/types";
  import { READABLE_SOURCES } from "$lib/types";
  import { api } from "$lib/api";
  import { CheckCircle, Star, XCircle } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { MapLibre, DefaultMarker } from "svelte-maplibre";

  let {
    job,
    onClose,
    applyInteraction,
    searchId,
    searchName,
  }: {
    job: Job;
    onClose?: () => void;
    applyInteraction?: (jobId: string, status: InteractionStatus | undefined) => void;
    searchId?: string;
    searchName?: string;
  } = $props();

  const dateFormatted = $derived(
    new Date(job.datePosted).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );

  const STATUS_LABEL: Record<InteractionStatus, string> = {
    SAVED: "Favori",
    APPLIED: "Postulé",
    REJECTED: "Refusé",
  };

  const interactionFormatted = $derived(
    job.interactionStatus && job.interactionAt
      ? `${STATUS_LABEL[job.interactionStatus]} le ${new Date(job.interactionAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
      : null,
  );

  async function toggleStatus(status: InteractionStatus) {
    const isActive = job.interactionStatus === status;
    try {
      if (isActive) {
        await api.deleteInteraction(job.id);
        applyInteraction?.(job.id, undefined);
      } else {
        await api.setInteraction(job.id, status, searchId, searchName);
        applyInteraction?.(job.id, status);
      }
    } catch {
      toast.error("Impossible d'enregistrer cette action");
    }
  }
</script>

<div
  class="h-full w-full md:w-[480px] flex flex-col pointer-events-auto bg-background/95 backdrop-blur border rounded-none md:rounded-xl shadow-panel overflow-hidden"
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

  {#if job.establishment}
    <div class="md:hidden h-40 border-b shrink-0">
      <MapLibre
        style="https://tiles.openfreemap.org/styles/liberty"
        class="w-full h-full"
        center={[job.establishment.lng, job.establishment.lat]}
        zoom={13}
      >
        <DefaultMarker lngLat={[job.establishment.lng, job.establishment.lat]} />
      </MapLibre>
    </div>
  {/if}

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
          ? 'bg-foreground text-background'
          : 'border hover:bg-muted'}"
      aria-label="Favori"
    >
      <Star size={15} />
      Favori
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
          ? 'bg-destructive text-destructive-foreground'
          : 'border hover:bg-muted'}"
      aria-label="Refusé"
    >
      <XCircle size={15} />
      Refusé
    </button>
  </div>

  {#if interactionFormatted}
    <p class="px-4 pb-2 -mt-1 text-xs text-muted-foreground text-center">
      {interactionFormatted}
    </p>
  {/if}
  <div class="px-4 pb-4 flex flex-col gap-2">
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      class="block w-full text-center bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
    >
      Voir l'offre ({READABLE_SOURCES[job.source]}) →
    </a>
    {#each job.alternates ?? [] as alt (alt.url)}
      <a
        href={alt.url}
        target="_blank"
        rel="noopener noreferrer"
        class="block w-full text-center border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        Voir sur {READABLE_SOURCES[alt.source]} →
      </a>
    {/each}
  </div>
</div>
