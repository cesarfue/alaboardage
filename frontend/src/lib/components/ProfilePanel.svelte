<script lang="ts">
  import { LogOut, X } from "@lucide/svelte";
  import type { Skill, SkillLevel } from "$lib/types";
  import type { AuthUser } from "$lib/auth";

  let {
    skills = $bindable(),
    user = null,
    onClose,
    onLogout,
  }: {
    skills: Skill[];
    user?: AuthUser | null;
    onClose: () => void;
    onLogout: () => void;
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
  class="pointer-events-auto w-[min(320px,calc(100vw-1.5rem))] flex flex-col gap-4 rounded-xl bg-background shadow-panel p-4"
>
  <div class="flex items-center justify-between">
    <h2 class="font-semibold text-sm">Compétences</h2>
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

  <div class="border-t pt-3 flex items-center justify-between gap-2">
    {#if user}
      <div class="min-w-0">
        <p class="text-sm font-medium truncate">{user.name}</p>
        <p class="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      <button
        onclick={onLogout}
        class="shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
      >
        <LogOut size={13} />
        Déconnexion
      </button>
    {:else}
      <a
        href="/api/auth/google"
        class="w-full text-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        Se connecter
      </a>
    {/if}
  </div>
</div>
