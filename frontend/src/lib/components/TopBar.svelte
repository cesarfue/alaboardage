<script lang="ts">
  import { Bell, BellOff, Bookmark, ClipboardList, Funnel, User, LogOut, Search, X } from "@lucide/svelte";
  import FiltersPanel from "$lib/components/FiltersPanel.svelte";
  import ProfilePanel from "$lib/components/ProfilePanel.svelte";
  import type { SavedSearch, Skill } from "$lib/types";
  import { clearToken } from "$lib/auth";
  import { userState } from "$lib/user.svelte";
  import { api } from "$lib/api";

  let {
    query = $bindable(),
    location = $bindable(),
    view = $bindable("search"),
    search,
    searching,
    skills = $bindable(),
    savedSearches = $bindable(),
    radiusKm = $bindable(),
    daysFilter = $bindable(),
    hideViewed = $bindable(false),
  }: {
    query: string;
    location: string;
    view?: "search" | "suivi";
    search: () => void;
    searching: boolean;
    skills: Skill[];
    savedSearches: SavedSearch[];
    radiusKm: number;
    daysFilter: number | null;
    hideViewed?: boolean;
  } = $props();

  function toggleView() {
    view = view === "suivi" ? "search" : "suivi";
    closeAll();
  }

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
    // A brand-new saved search has never been seen — its badge is 0 by
    // definition. Everything else comes straight from the DB response.
    savedSearches = [{ ...saved, newResultsCount: 0 }, ...savedSearches];
  }

  async function deleteSearch(id: string) {
    // Optimistic UI — restore on error so the item is never silently stuck
    const before = savedSearches;
    savedSearches = savedSearches.filter((s) => s.id !== id);
    try {
      await api.deleteSavedSearch(id);
    } catch (e) {
      console.error("Failed to delete saved search", e);
      savedSearches = before;
    }
  }

  async function toggleEmailAlerts(s: SavedSearch) {
    const nextValue = !s.emailAlerts;
    // Optimistic update
    savedSearches = savedSearches.map((x) =>
      x.id === s.id ? { ...x, emailAlerts: nextValue } : x,
    );
    try {
      await api.updateSavedSearch(s.id, { emailAlerts: nextValue });
    } catch (e) {
      console.error("Failed to update saved search", e);
      // Revert
      savedSearches = savedSearches.map((x) =>
        x.id === s.id ? { ...x, emailAlerts: s.emailAlerts } : x,
      );
    }
  }

  async function loadSearch(s: SavedSearch) {
    query = s.query;
    location = s.location;
    showingSaved = false;
    // Clear the badge immediately, then persist
    if ((s.newResultsCount ?? 0) > 0 || s.lastSeenAt === null) {
      savedSearches = savedSearches.map((x) =>
        x.id === s.id
          ? { ...x, newResultsCount: 0, lastSeenAt: new Date().toISOString() }
          : x,
      );
      api.markSavedSearchSeen(s.id).catch((e) => {
        console.error("Failed to mark saved search as seen", e);
      });
    }
    search();
  }

  function formatCheckedAt(iso: string | null): string {
    if (!iso) return "Jamais vérifiée";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Jamais vérifiée";
    return `Dernière vérif : ${d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
  }

  function formatBadge(n: number): string {
    return n > 99 ? "99+" : String(n);
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
  class="absolute w-full z-50 pointer-events-auto h-28 md:h-auto
         flex flex-row flex-wrap md:flex-nowrap items-center gap-1.5 md:gap-2 p-3 bg-background"
>
  <input
    type="text"
    placeholder="Poste"
    bind:value={query}
    class="min-w-0 flex-1 md:flex-none border rounded-lg px-2 md:px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    onkeydown={(e) => e.key === "Enter" && search()}
  />
  <input
    type="text"
    placeholder="Lieu"
    bind:value={location}
    class="min-w-0 flex-1 md:flex-none border rounded-lg px-2 md:px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    onkeydown={(e) => e.key === "Enter" && search()}
  />
  <div class="relative shrink-0">
    <button
      onclick={toggleFilters}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingFilters ? 'bg-muted' : ''}"
    >
      <Funnel size={16} />
    </button>
    {#if showingFilters}
      <div class="absolute top-full mt-1 z-50 left-0 max-md:fixed max-md:top-28 max-md:left-3 max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto">
        <FiltersPanel bind:radiusKm bind:daysFilter bind:hideViewed onClose={() => (showingFilters = false)} />
      </div>
    {/if}
  </div>
  <button
    onclick={search}
    aria-label="Rechercher"
    class="shrink-0 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
  >
    <Search size={16} class="md:hidden" />
    <span class="hidden md:inline">Rechercher</span>
  </button>
  {#if searching}
    <svg
      class="animate-spin h-4 w-4 text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Recherche en cours"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  {/if}
  <div class="basis-full md:hidden" aria-hidden="true"></div>

  <button
    onclick={toggleView}
    class="shrink-0 flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm font-medium transition-colors
      {view === 'suivi' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
    title="Suivi des candidatures (toutes recherches)"
  >
    <ClipboardList size={16} />
    <span class="hidden md:inline">Suivi</span>
  </button>
  <div class="relative shrink-0">
    <button
      onclick={toggleSaved}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingSaved ? 'bg-muted' : ''}"
      title="Recherches sauvegardées"
    >
      <Bookmark size={16} class={isCurrentSearchSaved ? "fill-current" : ""} />
    </button>
    {#if showingSaved}
      <div class="absolute top-full mt-1 z-50 left-0 max-md:fixed max-md:top-28 max-md:left-3 max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto w-[min(400px,calc(100vw-1.5rem))] flex flex-col rounded-xl bg-background shadow-xl p-3 gap-2">
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
              <li class="flex items-stretch gap-1 rounded-lg hover:bg-muted/60">
                <button
                  onclick={() => loadSearch(s)}
                  title={formatCheckedAt(s.lastCheckedAt)}
                  class="flex flex-col gap-0.5 flex-1 text-sm px-2 py-1.5 rounded-lg text-left min-w-0"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Search size={12} class="shrink-0 text-muted-foreground" />
                    <span class="truncate font-medium">{s.name}</span>
                    {#if (s.newResultsCount ?? 0) > 0}
                      <span
                        class="ml-auto shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 leading-none"
                        aria-label="{s.newResultsCount} nouveaux résultats"
                      >
                        {formatBadge(s.newResultsCount ?? 0)}
                      </span>
                    {/if}
                  </span>
                  <span class="text-xs text-muted-foreground truncate pl-5">
                    {[s.query, s.location].filter(Boolean).join(" · ") || "—"}
                  </span>
                </button>
                <button
                  onclick={() => toggleEmailAlerts(s)}
                  class="shrink-0 p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
                  title={s.emailAlerts ? "Notifs email activées" : "Notifs email désactivées"}
                  aria-pressed={s.emailAlerts}
                >
                  {#if s.emailAlerts}
                    <Bell size={14} class="text-primary" />
                  {:else}
                    <BellOff size={14} />
                  {/if}
                </button>
                <button
                  onclick={() => deleteSearch(s.id)}
                  class="shrink-0 p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
                  title="Supprimer"
                  aria-label="Supprimer {s.name}"
                >
                  <X size={14} />
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-xs text-muted-foreground px-1">Aucune recherche sauvegardée</p>
        {/if}
      </div>
    {/if}
  </div>

  <div class="relative shrink-0">
    <button
      onclick={toggleProfile}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingProfile ? 'bg-muted' : ''}"
    >
      <User size={16} />
    </button>
    {#if showingProfile}
      <div class="absolute top-full mt-1 z-50 right-0 max-md:fixed max-md:top-28 max-md:left-3 max-md:right-3 max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto">
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
