<script lang="ts">
  import { X } from "@lucide/svelte";
  import type { Skill, SkillLevel } from "$lib/types";

  let {
    skills = $bindable(),
    radiusKm = $bindable(),
    daysFilter = $bindable(),
    hideViewed = $bindable(false),
    autoScrapeEnabled = $bindable(),
    autoScrapeIntervalMinutes = $bindable(),
    onClose,
  }: {
    skills: Skill[];
    radiusKm: number;
    daysFilter: number | null;
    hideViewed?: boolean;
    autoScrapeEnabled: boolean;
    autoScrapeIntervalMinutes: number;
    onClose: () => void;
  } = $props();

  let primaryInput = $state("");
  let secondaryInput = $state("");

  function add(level: SkillLevel, name: string): string {
    const trimmed = name.trim();
    if (
      trimmed &&
      !skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      skills = [...skills, { name: trimmed, level }];
      return "";
    }
    return name;
  }

  function remove(name: string) {
    skills = skills.filter((s) => s.name !== name);
  }

  const primary = $derived(skills.filter((s) => s.level === "primary"));
  const secondary = $derived(skills.filter((s) => s.level === "secondary"));

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

  const intervalOptions: { label: string; value: number }[] = [
    { label: "15 min", value: 15 },
    { label: "30 min", value: 30 },
    { label: "1h", value: 60 },
    { label: "2h", value: 120 },
    { label: "6h", value: 360 },
    { label: "12h", value: 720 },
    { label: "24h", value: 1440 },
  ];
</script>

{#snippet skillSection(
  label: string,
  level: SkillLevel,
  list: Skill[],
  badgeClass: string,
  inputValue: string,
  onInput: (v: string) => void,
)}
  <section class="flex flex-col gap-2">
    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {label}
    </p>
    <div class="flex flex-wrap gap-1.5 min-h-[28px]">
      {#each list as skill (skill.name)}
        <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs {badgeClass}">
          {skill.name}
          <button onclick={() => remove(skill.name)} class="opacity-70 hover:opacity-100">
            <X size={10} />
          </button>
        </span>
      {/each}
    </div>
    <input
      type="text"
      placeholder="Ajouter… (Entrée)"
      value={inputValue}
      oninput={(e) => onInput((e.target as HTMLInputElement).value)}
      onkeydown={(e) => {
        if (e.key === "Enter") onInput(add(level, inputValue));
      }}
      class="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring w-full"
    />
  </section>
{/snippet}

<div
  class="pointer-events-auto w-[min(340px,calc(100vw-1.5rem))] flex flex-col gap-4 rounded-xl bg-background shadow-panel p-4 max-h-[calc(100dvh-8rem)] overflow-y-auto"
>
  <div class="flex items-center justify-between">
    <h2 class="font-semibold text-sm">Paramètres</h2>
    <button onclick={onClose} class="text-muted-foreground hover:text-foreground">
      <X size={16} />
    </button>
  </div>

  {@render skillSection(
    "Compétences principales",
    "primary",
    primary,
    "bg-primary text-primary-foreground",
    primaryInput,
    (v) => (primaryInput = v),
  )}

  {@render skillSection(
    "Compétences secondaires",
    "secondary",
    secondary,
    "bg-muted text-muted-foreground",
    secondaryInput,
    (v) => (secondaryInput = v),
  )}

  <div class="border-t pt-3 flex flex-col gap-2">
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
  </div>

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

  <section class="border-t pt-3 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Mise à jour du flux
      </p>
      <button
        onclick={() => (autoScrapeEnabled = !autoScrapeEnabled)}
        role="switch"
        aria-label="Activer la mise à jour automatique du flux"
        aria-checked={autoScrapeEnabled}
        class="relative h-5 w-9 rounded-full transition-colors {autoScrapeEnabled ? 'bg-primary' : 'bg-muted'}"
      >
        <span
          class="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-background transition-transform {autoScrapeEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}"
        ></span>
      </button>
    </div>
    {#if autoScrapeEnabled}
      <div class="flex flex-wrap gap-2">
        {#each intervalOptions as opt (opt.value)}
          <button
            onclick={() => (autoScrapeIntervalMinutes = opt.value)}
            class="px-3 py-1 rounded-full text-xs border transition-colors
                   {autoScrapeIntervalMinutes === opt.value
                     ? 'bg-primary text-primary-foreground border-primary'
                     : 'bg-background text-foreground hover:bg-muted border-border'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>
    {:else}
      <p class="text-xs text-muted-foreground">
        Rafraîchis une recherche manuellement depuis son onglet.
      </p>
    {/if}
  </section>
</div>
