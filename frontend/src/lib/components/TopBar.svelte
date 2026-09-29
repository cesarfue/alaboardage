<script lang="ts">
  import { Bookmark, ChevronDown, ClipboardList, Funnel, Layers, Pencil, User, Search } from "@lucide/svelte";
  import FiltersPanel from "$lib/components/FiltersPanel.svelte";
  import NavMenu from "$lib/components/NavMenu.svelte";
  import ProfilePanel from "$lib/components/ProfilePanel.svelte";
  import SearchEditor from "$lib/components/SearchEditor.svelte";
  import { toast } from "svelte-sonner";
  import type { SavedSearch, Skill, View } from "$lib/types";
  import { clearToken } from "$lib/auth";
  import { userState } from "$lib/user.svelte";
  import { api } from "$lib/api";

  let {
    query = $bindable(""),
    location = $bindable(""),
    view,
    feedNewCount = null,
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
    query?: string;
    location?: string;
    view: View;
    feedNewCount?: number | null;
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
  let showingNav = $state(false);

  const user = $derived(userState.user);
  const activeSearch = $derived.by(() => {
    const current = view;
    if (current.kind !== "saved") return undefined;
    return savedSearches.find((s) => s.id === current.id);
  });

  const currentViewLabel = $derived.by(() => {
    if (view.kind === "all") return "Toutes les recherches";
    if (view.kind === "suivi") return "Suivi";
    if (view.kind === "saved")
      return activeSearch?.name ?? "Recherche sauvegardée";
    return "Nouvelle recherche";
  });

  function closeAll() {
    showingFilters = false;
    showingProfile = false;
    showingNav = false;
  }

  function toggleFilters() {
    const next = !showingFilters;
    closeAll();
    showingFilters = next;
  }

  function toggleProfile() {
    const next = !showingProfile;
    closeAll();
    showingProfile = next;
  }

  function toggleNav() {
    const next = !showingNav;
    closeAll();
    showingNav = next;
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

  const totalNew = $derived(
    feedNewCount ??
      savedSearches.reduce((sum, s) => sum + (s.newResultsCount ?? 0), 0),
  );

  let editing = $state<{ id: string | null } | null>(null);
  let editorName = $state("");
  let editorQuery = $state("");
  let editorLocation = $state("");

  function openEditor(s?: SavedSearch) {
    editing = { id: s?.id ?? null };
    editorQuery = s?.queries[0] ?? query.trim();
    editorLocation = s?.locations[0] ?? location.trim();
    editorName =
      s?.name ?? [editorQuery, editorLocation].filter(Boolean).join(" · ");
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
        savedSearches = [...savedSearches, { ...created, newResultsCount: 0 }];
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

  const activeIndex = $derived(
    activeSearch ? savedSearches.findIndex((s) => s.id === activeSearch.id) : -1,
  );

  async function moveSearch(id: string, delta: number) {
    const index = savedSearches.findIndex((s) => s.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= savedSearches.length) return;
    const next = [...savedSearches];
    [next[index], next[target]] = [next[target], next[index]];
    savedSearches = next.map((s, position) => ({ ...s, position }));
    try {
      await api.reorderSearches(next.map((s) => s.id));
    } catch {
      toast.error("Impossible de réordonner les onglets");
    }
  }

  function formatBadge(n: number): string {
    return n > 99 ? "99+" : String(n);
  }
</script>

{#if showingFilters || showingProfile || showingNav}
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
  <div class="relative flex-1 min-w-0 md:hidden">
    <button
      onclick={toggleNav}
      class="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted {showingNav ? 'bg-muted' : ''}"
    >
      <span class="truncate">{currentViewLabel}</span>
      <span class="flex items-center gap-1.5 shrink-0">
        {#if totalNew > 0}
          <span
            class="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 leading-none"
          >
            {formatBadge(totalNew)}
          </span>
        {/if}
        <ChevronDown size={14} class="text-muted-foreground" />
      </span>
    </button>
    {#if showingNav}
      <div class="absolute top-full mt-1 z-50 left-0 right-0 max-md:fixed max-md:top-28 max-md:left-3 max-md:right-3 max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto">
        <NavMenu
          {view}
          {savedSearches}
          onSelect={(v) => goTo(v)}
          onClose={() => (showingNav = false)}
        />
      </div>
    {/if}
  </div>
  <div class="hidden md:flex flex-1 min-w-0 flex-row items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {#if savedSearches.length > 0}
      <button
        onclick={() => goTo({ kind: "all" })}
        class="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
          {view.kind === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'border hover:bg-muted'}"
        title="Toutes les recherches"
      >
        <Layers size={16} />
        <span>Tout</span>
        {#if totalNew > 0}
          <span
            class="rounded-full bg-background text-foreground text-[10px] font-semibold px-1.5 py-0.5 leading-none"
          >
            {formatBadge(totalNew)}
          </span>
        {/if}
      </button>
    {/if}
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
      <div class="absolute top-full mt-1 z-50 right-0 max-md:fixed max-md:top-28 max-md:left-3 max-md:right-3 max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto">
        <FiltersPanel bind:radiusKm bind:daysFilter bind:hideViewed onClose={() => (showingFilters = false)} />
      </div>
    {/if}
  </div>
  <div class="relative shrink-0">
    {#if activeSearch}
      <button
        onclick={() => (editing ? (editing = null) : openEditor(activeSearch))}
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
          bind:query={editorQuery}
          bind:location={editorLocation}
          title={editing.id === null
            ? "Enregistrer cette recherche"
            : "Modifier la recherche"}
          submitLabel={editing.id === null ? "Enregistrer" : "Mettre à jour"}
          emailAlerts={activeSearch?.emailAlerts ?? true}
          onToggleAlerts={activeSearch
            ? () => toggleEmailAlerts(activeSearch)
            : undefined}
          onMoveLeft={editing.id !== null && activeSearch && activeIndex > 0
            ? () => moveSearch(activeSearch.id, -1)
            : undefined}
          onMoveRight={editing.id !== null &&
          activeSearch &&
          activeIndex < savedSearches.length - 1
            ? () => moveSearch(activeSearch.id, 1)
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
          {user}
          onClose={() => (showingProfile = false)}
          onLogout={logout}
        />
      </div>
    {/if}
  </div>
</div>
{#if view.kind === "new"}
  <div class="flex flex-row items-center gap-1.5 md:gap-2 min-w-0">
    <input
      type="text"
      placeholder="Poste"
      bind:value={query}
      class="min-w-0 flex-1 border rounded-lg px-2 md:px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      onkeydown={(e) => e.key === "Enter" && search()}
    />
    <input
      type="text"
      placeholder="Lieu"
      bind:value={location}
      class="min-w-0 flex-1 border rounded-lg px-2 md:px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      onkeydown={(e) => e.key === "Enter" && search()}
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
      disabled={!query.trim() && !location.trim()}
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
