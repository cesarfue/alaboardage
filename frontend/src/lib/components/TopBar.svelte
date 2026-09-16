<script lang="ts">
  import { Bookmark, ClipboardList, Funnel, Pencil, User, LogOut, Search } from "@lucide/svelte";
  import FiltersPanel from "$lib/components/FiltersPanel.svelte";
  import ProfilePanel from "$lib/components/ProfilePanel.svelte";
  import SearchEditor from "$lib/components/SearchEditor.svelte";
  import CriteriaInput from "$lib/components/CriteriaInput.svelte";
  import { toast } from "svelte-sonner";
  import type { SavedSearch, Skill, View } from "$lib/types";
  import { clearToken } from "$lib/auth";
  import { userState } from "$lib/user.svelte";
  import { api } from "$lib/api";

  let {
    queries = $bindable<string[]>([]),
    locations = $bindable<string[]>([]),
    view,
    search,
    searching,
    skills = $bindable(),
    savedSearches = $bindable(),
    radiusKm = $bindable(),
    daysFilter = $bindable(),
    hideViewed = $bindable(false),
    barHeight = $bindable(0),
    openView,
  }: {
    queries?: string[];
    locations?: string[];
    view: View;
    search: () => void;
    searching: boolean;
    skills: Skill[];
    savedSearches: SavedSearch[];
    radiusKm: number;
    daysFilter: number | null;
    hideViewed?: boolean;
    barHeight?: number;
    openView: (v: View) => void;
  } = $props();

  function goTo(next: View) {
    closeAll();
    openView(next);
  }

  let showingFilters = $state(false);
  let showingProfile = $state(false);

  const user = $derived(userState.user);
  const activeSearch = $derived.by(() => {
    const current = view;
    if (current.kind !== "saved") return undefined;
    return savedSearches.find((s) => s.id === current.id);
  });

  function closeAll() {
    showingFilters = false;
    showingProfile = false;
  }

  function toggleFilters() {
    showingFilters = !showingFilters;
    if (showingFilters) showingProfile = false;
  }

  function toggleProfile() {
    showingProfile = !showingProfile;
    if (showingProfile) showingFilters = false;
  }

  function logout() {
    clearToken();
    window.location.href = "/";
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

  let queryDraft = $state("");
  let locationDraft = $state("");

  let editing = $state<{ id: string | null } | null>(null);
  let editorName = $state("");
  let editorQueries = $state<string[]>([]);
  let editorLocations = $state<string[]>([]);

  function openEditor(s?: SavedSearch) {
    editing = { id: s?.id ?? null };
    editorQueries = s ? [...s.queries] : [...queries];
    editorLocations = s ? [...s.locations] : [...locations];
    editorName =
      s?.name ??
      [editorQueries.join(", "), editorLocations.join(", ")]
        .filter(Boolean)
        .join(" · ");
    closeAll();
  }

  async function deleteFromEditor(id: string) {
    editing = null;
    await deleteSearch(id);
    goTo({ kind: "new" });
  }

  async function submitEditor(v: {
    name: string;
    queries: string[];
    locations: string[];
  }) {
    const target = editing;
    if (!target) return;
    editing = null;
    try {
      if (target.id === null) {
        const created = await api.saveSearch(v.name, v.queries, v.locations);
        savedSearches = [{ ...created, newResultsCount: 0 }, ...savedSearches];
        goTo({ kind: "saved", id: created.id });
      } else {
        const updated = await api.updateSavedSearch(target.id, v);
        savedSearches = savedSearches.map((s) =>
          s.id === updated.id ? { ...s, ...updated } : s,
        );
        goTo({ kind: "saved", id: updated.id });
      }
    } catch {
      toast.error("Impossible d'enregistrer cette recherche");
    }
  }

  function formatBadge(n: number): string {
    return n > 99 ? "99+" : String(n);
  }
</script>

{#if showingFilters || showingProfile}
  <div
    class="fixed inset-0 z-40"
    role="presentation"
    onclick={closeAll}
    onkeydown={(e) => e.key === "Escape" && closeAll()}
  ></div>
{/if}

<div
  bind:clientHeight={barHeight}
  class="absolute w-full z-50 pointer-events-auto flex flex-col gap-2 p-3 bg-background"
>
<div class="flex flex-row items-center gap-1.5 md:gap-2 min-w-0">
  <div class="flex-1 min-w-0 flex flex-row items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {#each savedSearches as s (s.id)}
      <button
        onclick={() => goTo({ kind: "saved", id: s.id })}
        class="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
          {view.kind === 'saved' && view.id === s.id
            ? 'bg-primary text-primary-foreground'
            : 'border hover:bg-muted'}"
      >
        <span class="max-w-[10rem] truncate">{s.name}</span>
        {#if (s.newResultsCount ?? 0) > 0}
          <span
            class="rounded-full bg-background text-foreground text-[10px] font-semibold px-1.5 py-0.5 leading-none"
          >
            {formatBadge(s.newResultsCount ?? 0)}
          </span>
        {/if}
      </button>
    {/each}
    <button
      onclick={() => goTo({ kind: "new" })}
      class="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
        {view.kind === 'new'
          ? 'bg-primary text-primary-foreground'
          : 'border hover:bg-muted'}"
    >
      <Search size={16} />
      <span class="hidden sm:inline">Nouvelle recherche</span>
    </button>
    <button
      onclick={() => goTo({ kind: "suivi" })}
      class="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
        {view.kind === 'suivi'
          ? 'bg-primary text-primary-foreground'
          : 'border hover:bg-muted'}"
      title="Suivi des candidatures (toutes recherches)"
    >
      <ClipboardList size={16} />
      <span class="hidden sm:inline">Suivi</span>
    </button>
  </div>
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
  <div class="relative shrink-0">
    {#if activeSearch}
      <button
        onclick={() => openEditor(activeSearch)}
        class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {editing ? 'bg-muted' : ''}"
        title="Modifier cette recherche"
        aria-label="Modifier cette recherche"
      >
        <Pencil size={16} />
      </button>
    {/if}
    {#if editing}
      <div class="absolute top-full mt-1 z-50 right-0 max-md:fixed max-md:top-28 max-md:left-3 max-md:right-3 max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto">
        <SearchEditor
          bind:name={editorName}
          bind:queries={editorQueries}
          bind:locations={editorLocations}
          title={editing.id === null
            ? "Enregistrer cette recherche"
            : "Modifier la recherche"}
          submitLabel={editing.id === null ? "Enregistrer" : "Mettre à jour"}
          emailAlerts={activeSearch?.emailAlerts ?? true}
          onToggleAlerts={activeSearch
            ? () => toggleEmailAlerts(activeSearch)
            : undefined}
          onDelete={editing.id === null
            ? undefined
            : () => deleteFromEditor(editing!.id!)}
          onSubmit={submitEditor}
          onClose={() => (editing = null)}
        />
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
{#if view.kind === "new"}
  <div class="flex flex-row items-center gap-1.5 md:gap-2 min-w-0">
    <CriteriaInput
      bind:values={queries}
      bind:draft={queryDraft}
      placeholder="Poste"
      onEnterEmpty={search}
    />
    <CriteriaInput
      bind:values={locations}
      bind:draft={locationDraft}
      placeholder="Lieu"
      onEnterEmpty={search}
    />
    <button
      onclick={search}
      aria-label="Rechercher"
      class="shrink-0 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
    >
      <Search size={16} class="md:hidden" />
      <span class="hidden md:inline">Rechercher</span>
    </button>
    <button
      onclick={() => openEditor()}
      disabled={queries.length === 0 && locations.length === 0}
      aria-label="Enregistrer cette recherche"
      title="Enregistrer cette recherche"
      class="shrink-0 flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm font-medium
             hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Bookmark size={16} />
      <span class="hidden md:inline">Enregistrer</span>
    </button>
    {#if searching}
      <svg
        class="animate-spin h-4 w-4 text-primary shrink-0"
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
  </div>
{/if}
</div>
