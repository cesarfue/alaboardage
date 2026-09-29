<script lang="ts">
  import { X } from "@lucide/svelte";

  let {
    radiusKm = $bindable(),
    daysFilter = $bindable(),
    hideViewed = $bindable(false),
    onClose,
  }: {
    radiusKm: number;
    daysFilter: number | null;
    hideViewed?: boolean;
    onClose: () => void;
  } = $props();

  const dateOptions: { label: string; value: number | null }[] = [
    { label: "7 jours", value: 7 },
    { label: "14 jours", value: 14 },
    { label: "30 jours", value: 30 },
    { label: "3 mois", value: 90 },
    { label: "Tout", value: null },
  ];

  const viewedOptions: { label: string; value: boolean }[] = [
    { label: "Afficher", value: false },
    { label: "Masquer", value: true },
  ];
</script>

<div
  class="pointer-events-auto w-[min(300px,calc(100vw-1.5rem))] flex flex-col gap-4 rounded-xl bg-background shadow-panel p-4"
>
  <div class="flex items-center justify-between">
    <h2 class="font-semibold text-sm">Filtres</h2>
    <button onclick={onClose} class="text-muted-foreground hover:text-foreground">
      <X size={16} />
    </button>
  </div>

  <!-- Radius filter -->
  <section class="flex flex-col gap-2">
    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Rayon géographique
    </p>
    <div class="flex items-center gap-3">
      <input
        type="range"
        min="10"
        max="500"
        step="10"
        bind:value={radiusKm}
        class="flex-1 accent-primary"
      />
      <span class="text-sm font-medium w-16 text-right">
        {radiusKm >= 500 ? "Illimité" : `${radiusKm} km`}
      </span>
    </div>
    {#if radiusKm < 500}
      <p class="text-xs text-muted-foreground">
        Jobs sans coordonnées exclus
      </p>
    {/if}
  </section>

  <!-- Date filter -->
  <section class="flex flex-col gap-2">
    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Date de publication
    </p>
    <div class="flex flex-wrap gap-2">
      {#each dateOptions as opt (opt.label)}
        <button
          onclick={() => (daysFilter = opt.value)}
          class="px-3 py-1 rounded-full text-xs border transition-colors
                 {daysFilter === opt.value
                   ? 'bg-primary text-primary-foreground border-primary'
                   : 'bg-background text-foreground hover:bg-muted border-border'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </section>

  <section class="flex flex-col gap-2">
    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Offres déjà vues
    </p>
    <div class="flex flex-wrap gap-2">
      {#each viewedOptions as opt (opt.label)}
        <button
          onclick={() => (hideViewed = opt.value)}
          class="px-3 py-1 rounded-full text-xs border transition-colors
                 {hideViewed === opt.value
                   ? 'bg-primary text-primary-foreground border-primary'
                   : 'bg-background text-foreground hover:bg-muted border-border'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </section>

</div>
