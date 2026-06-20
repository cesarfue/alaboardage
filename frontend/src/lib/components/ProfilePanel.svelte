<script lang="ts">
  import { Search, X } from "@lucide/svelte";
  import type { SavedSearch, Skill, SkillLevel } from "$lib/types";
  import { api } from "$lib/api";

  let {
    skills = $bindable(),
    savedSearches = $bindable(),
    onClose,
    onSearch,
  }: {
    skills: Skill[];
    savedSearches: SavedSearch[];
    onClose: () => void;
    onSearch?: (query: string, location: string) => void;
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

  async function deleteSearch(id: string) {
    await api.deleteSavedSearch(id);
    savedSearches = savedSearches.filter((s) => s.id !== id);
  }

  const primary = $derived(skills.filter((s) => s.level === "primary"));
  const secondary = $derived(skills.filter((s) => s.level === "secondary"));
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
  class="pointer-events-auto w-[320px] flex flex-col gap-4 rounded-xl bg-background shadow-xl p-4"
>
  <div class="flex items-center justify-between">
    <h2 class="font-semibold text-sm">Profil de compétences</h2>
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

  <section class="flex flex-col gap-2">
    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Recherches sauvegardées
    </p>
    {#if savedSearches.length === 0}
      <p class="text-xs text-muted-foreground">Aucune recherche sauvegardée</p>
    {:else}
      <ul class="flex flex-col gap-1">
        {#each savedSearches as s (s.id)}
          <li class="flex items-center justify-between gap-2 text-sm">
            <span class="truncate flex-1">{s.name}</span>
            <div class="flex items-center gap-1 shrink-0">
              <button
                onclick={() => onSearch?.(s.query, s.location)}
                class="text-muted-foreground hover:text-foreground"
                title="Rechercher"
              >
                <Search size={14} />
              </button>
              <button
                onclick={() => deleteSearch(s.id)}
                class="text-muted-foreground hover:text-foreground"
                title="Supprimer"
              >
                <X size={14} />
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
