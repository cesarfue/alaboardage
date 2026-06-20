<script lang="ts">
  import { Bookmark, Funnel, User, LogOut, Search, X } from "@lucide/svelte";
  import FiltersPanel from "$lib/components/FiltersPanel.svelte";
  import ProfilePanel from "$lib/components/ProfilePanel.svelte";
  import type { SavedSearch, Skill } from "$lib/types";
  import { clearToken } from "$lib/auth";
  import { userState } from "$lib/user.svelte";
  import { api } from "$lib/api";

  let {
    query = $bindable(),
    location = $bindable(),
    search,
    searching,
    skills = $bindable(),
    savedSearches = $bindable(),
    radiusKm = $bindable(),
    daysFilter = $bindable(),
  }: {
    query: string;
    location: string;
    search: () => void;
    searching: boolean;
    skills: Skill[];
    savedSearches: SavedSearch[];
    radiusKm: number;
    daysFilter: number | null;
  } = $props();

  let showingFilters = $state(false);
  let showingProfile = $state(false);
  let showingSaved = $state(false);

  const user = $derived(userState.user);
  const canSave = $derived(!!(query || location) && !!user);
  const isCurrentSearchSaved = $derived(
    savedSearches.some((s) => s.query === query && s.location === location),
  );

  function closeAll() {
    showingFilters = false;
    showingProfile = false;
    showingSaved = false;
  }

  function toggleFilters() {
    showingFilters = !showingFilters;
    if (showingFilters) { showingProfile = false; showingSaved = false; }
  }

  function toggleProfile() {
    showingProfile = !showingProfile;
    if (showingProfile) { showingFilters = false; showingSaved = false; }
  }

  function toggleSaved() {
    showingSaved = !showingSaved;
    if (showingSaved) { showingFilters = false; showingProfile = false; }
  }

  function logout() {
    clearToken();
    window.location.href = "/";
  }

  async function saveSearch() {
    if (!canSave || isCurrentSearchSaved) return;
    const name = [query, location].filter(Boolean).join(" · ");
    const saved = await api.saveSearch(name, query, location);
    savedSearches = [saved, ...savedSearches];
  }

  async function deleteSearch(id: string) {
    await api.deleteSavedSearch(id);
    savedSearches = savedSearches.filter((s) => s.id !== id);
  }

  function loadSearch(q: string, loc: string) {
    query = q;
    location = loc;
    showingSaved = false;
    search();
  }
</script>

{#if showingFilters || showingProfile || showingSaved}
  <div
    class="fixed inset-0 z-40"
    role="presentation"
    onclick={closeAll}
    onkeydown={(e) => e.key === "Escape" && closeAll()}
  ></div>
{/if}

<div
  class="absolute w-full z-20 pointer-events-auto
         flex flex-row items-center gap-2 p-3 bg-background"
>
  <input
    type="text"
    placeholder="Poste"
    bind:value={query}
    class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
  />
  <input
    type="text"
    placeholder="Lieu"
    bind:value={location}
    class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    onkeydown={(e) => e.key === "Enter" && search()}
  />
  <div class="relative">
    <button
      onclick={toggleFilters}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingFilters ? 'bg-muted' : ''}"
    >
      <Funnel size={16} />
    </button>
    {#if showingFilters}
      <div class="absolute top-full mt-1 z-50 left-0">
        <FiltersPanel bind:radiusKm bind:daysFilter onClose={() => (showingFilters = false)} />
      </div>
    {/if}
  </div>
  <button
    onclick={search}
    class="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
  >
    Rechercher
  </button>
  {#if searching}
    <span class="text-xs text-muted-foreground animate-pulse">Recherche…</span>
  {/if}

  {#if user}
    <div class="relative">
      <button
        onclick={toggleSaved}
        class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingSaved ? 'bg-muted' : ''}"
        title="Recherches sauvegardées"
      >
        <Bookmark size={16} class={isCurrentSearchSaved ? "fill-current" : ""} />
      </button>
      {#if showingSaved}
        <div class="absolute top-full mt-1 z-50 left-0 w-[280px] flex flex-col rounded-xl bg-background shadow-xl p-3 gap-2">
          {#if canSave}
            {#if isCurrentSearchSaved}
              <p class="text-xs text-muted-foreground px-1">Déjà sauvegardée</p>
            {:else}
              <button
                onclick={saveSearch}
                class="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted text-left w-full"
              >
                <Bookmark size={14} />
                Sauvegarder cette recherche
              </button>
            {/if}
          {/if}
          {#if savedSearches.length > 0}
            {#if canSave}<hr class="border-border" />{/if}
            <ul class="flex flex-col gap-0.5">
              {#each savedSearches as s (s.id)}
                <li class="flex items-center gap-1 group">
                  <button
                    onclick={() => loadSearch(s.query, s.location)}
                    class="flex items-center gap-2 flex-1 text-sm px-2 py-1.5 rounded-lg hover:bg-muted text-left truncate"
                  >
                    <Search size={12} class="shrink-0 text-muted-foreground" />
                    <span class="truncate">{s.name}</span>
                  </button>
                  <button
                    onclick={() => deleteSearch(s.id)}
                    class="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
                    title="Supprimer"
                  >
                    <X size={12} />
                  </button>
                </li>
              {/each}
            </ul>
          {:else if !canSave}
            <p class="text-xs text-muted-foreground px-1">Aucune recherche sauvegardée</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <div class="relative">
    <button
      onclick={toggleProfile}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingProfile ? 'bg-muted' : ''}"
    >
      <User size={16} />
    </button>
    {#if showingProfile}
      <div class="absolute top-full mt-1 z-50 right-0">
        <ProfilePanel
          bind:skills
          onClose={() => (showingProfile = false)}
        />
      </div>
    {/if}
  </div>

  <span class="text-sm text-muted-foreground hidden sm:block">{user?.name ?? ""}</span>
  {#if user}
    <button
      onclick={logout}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted"
      title="Déconnexion"
    >
      <LogOut size={16} />
    </button>
  {:else}
    <a
      href="/api/auth/google"
      class="border rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted whitespace-nowrap"
    >
      Se connecter
    </a>
  {/if}
</div>
