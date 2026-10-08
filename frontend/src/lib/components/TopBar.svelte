<script lang="ts">
  import {
    Ban,
    CheckCircle,
    ChevronDown,
    Eye,
    EyeOff,
    Pencil,
    RefreshCw,
    Search,
    Settings,
    Star,
    X,
    XCircle,
  } from "@lucide/svelte";
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";
  import SearchEditor from "$lib/components/SearchEditor.svelte";
  import { toast } from "svelte-sonner";
  import type {
    InteractionStatus,
    JobSource,
    RefreshState,
    SavedSearch,
    Skill,
    SortMode,
    View,
  } from "$lib/types";
  import { READABLE_SOURCES } from "$lib/types";
  import { api } from "$lib/api";

  let {
    query = $bindable(""),
    location = $bindable(""),
    view,
    feedNewCount = null,
    search,
    searching,
    jobCount,
    loading = false,
    refreshState = "idle",
    onRequestRefresh,
    skills = $bindable(),
    savedSearches = $bindable(),
    radiusKm = $bindable(),
    daysFilter = $bindable(null),
    hideViewed = $bindable(false),
    source = $bindable(null),
    company = $bindable(""),
    status = $bindable(null),
    sortMode = $bindable("date"),
    autoScrapeEnabled = $bindable(true),
    autoScrapeIntervalMinutes = $bindable(360),
    barHeight = $bindable(0),
    openView,
    selectedCount = 0,
    onBulkStatus,
    onBulkViewed,
    onClearSelection,
  }: {
    query?: string;
    location?: string;
    view: View;
    feedNewCount?: number | null;
    search: () => void;
    searching: boolean;
    jobCount: number;
    loading?: boolean;
    refreshState?: RefreshState;
    onRequestRefresh?: () => void;
    skills: Skill[];
    savedSearches: SavedSearch[];
    radiusKm: number;
    daysFilter: number | null;
    hideViewed?: boolean;
    source?: JobSource | null;
    company?: string;
    status?: InteractionStatus | null;
    sortMode?: SortMode;
    autoScrapeEnabled?: boolean;
    autoScrapeIntervalMinutes?: number;
    barHeight?: number;
    openView: (v: View) => void;
    selectedCount?: number;
    onBulkStatus?: (status: InteractionStatus | null) => void;
    onBulkViewed?: (viewed: boolean) => void;
    onClearSelection?: () => void;
  } = $props();

  function goTo(next: View) {
    closeAll();
    openView(next);
  }

  let showingSettings = $state(false);
  let showingScope = $state(false);

  const activeSearch = $derived.by(() => {
    const current = view;
    if (current.kind !== "saved") return undefined;
    return savedSearches.find((s) => s.id === current.id);
  });

  const currentViewLabel = $derived.by(() => {
    if (view.kind === "all") return "Toutes les recherches";
    if (view.kind === "saved")
      return activeSearch?.name ?? "Recherche sauvegardée";
    return "Nouvelle recherche";
  });

  function closeAll() {
    showingSettings = false;
    showingScope = false;
    editing = null;
  }

  function toggleSettings() {
    const next = !showingSettings;
    closeAll();
    showingSettings = next;
  }

  function toggleScope() {
    const next = !showingScope;
    closeAll();
    showingScope = next;
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

  const totalNew = $derived(
    feedNewCount ??
      savedSearches.reduce((sum, s) => sum + (s.newResultsCount ?? 0), 0),
  );

  let editing = $state<{ id: string | null } | null>(null);
  let editorName = $state("");
  let editorQuery = $state("");
  let editorLocation = $state("");

  function openEditor(s?: SavedSearch) {
    closeAll();
    editing = { id: s?.id ?? null };
    editorQuery = s?.queries[0] ?? query.trim();
    editorLocation = s?.locations[0] ?? location.trim();
    editorName =
      s?.name ?? [editorQuery, editorLocation].filter(Boolean).join(" · ");
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

  const statusChips: { label: string; value: InteractionStatus | null }[] = [
    { label: "Tout", value: null },
    { label: "Favori", value: "SAVED" },
    { label: "Postulé", value: "APPLIED" },
    { label: "Refusé", value: "REJECTED" },
  ];

  const dateOptions: { label: string; value: number | null }[] = [
    { label: "7 jours", value: 7 },
    { label: "14 jours", value: 14 },
    { label: "30 jours", value: 30 },
    { label: "3 mois", value: 90 },
    { label: "Tout", value: null },
  ];

  const sources: JobSource[] = Object.keys(READABLE_SOURCES) as JobSource[];

  const hasActiveFilters = $derived(
    hideViewed ||
      daysFilter !== 30 ||
      source !== null ||
      company.trim() !== "" ||
      status !== null ||
      sortMode !== "date",
  );

  function clearFilters() {
    hideViewed = false;
    daysFilter = 30;
    source = null;
    company = "";
    status = null;
    sortMode = "date";
  }

  const refreshLabel = $derived(
    refreshState === "running"
      ? "Mise à jour du flux en cours…"
      : refreshState === "queued"
        ? "En file d'attente"
        : "Relancer la mise à jour du flux",
  );
</script>

{#if showingSettings || showingScope || editing}
  <div
    class="fixed inset-0 z-40"
    role="presentation"
    onclick={closeAll}
    onkeydown={(e) => e.key === "Escape" && closeAll()}
  ></div>
{/if}

<div
  bind:clientHeight={barHeight}
  class="shrink-0 flex flex-col gap-2 p-3 border-b bg-background"
>
  {#if selectedCount > 0}
    <div class="flex items-center gap-1.5 md:gap-2 flex-wrap">
      <span class="text-sm font-medium px-1">
        {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
      </span>
      <button
        onclick={() => onBulkStatus?.("SAVED")}
        title="Marquer favori"
        aria-label="Marquer favori"
        class="border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <Star size={15} />
      </button>
      <button
        onclick={() => onBulkStatus?.("APPLIED")}
        title="Marquer postulé"
        aria-label="Marquer postulé"
        class="border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <CheckCircle size={15} />
      </button>
      <button
        onclick={() => onBulkStatus?.("REJECTED")}
        title="Marquer refusé"
        aria-label="Marquer refusé"
        class="border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <XCircle size={15} />
      </button>
      <button
        onclick={() => onBulkStatus?.(null)}
        title="Retirer le statut"
        aria-label="Retirer le statut"
        class="border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <Ban size={15} />
      </button>
      <button
        onclick={() => onBulkViewed?.(true)}
        title="Marquer lu"
        aria-label="Marquer lu"
        class="border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <Eye size={15} />
      </button>
      <button
        onclick={() => onBulkViewed?.(false)}
        title="Marquer non lu"
        aria-label="Marquer non lu"
        class="border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <EyeOff size={15} />
      </button>
      <button
        onclick={onClearSelection}
        title="Annuler la sélection"
        aria-label="Annuler la sélection"
        class="ml-auto text-muted-foreground hover:text-foreground transition-colors px-2"
      >
        <X size={16} />
      </button>
    </div>
  {:else}
    <div class="flex flex-row items-center gap-1.5 md:gap-2 min-w-0">
      <div class="flex-1 min-w-0">
        <button
          onclick={toggleScope}
          class="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted {showingScope ? 'bg-muted' : ''}"
        >
          <span class="truncate">{currentViewLabel}</span>
          <span class="flex items-center gap-1.5 shrink-0 text-muted-foreground">
            <span class="text-xs font-normal whitespace-nowrap">
              {loading ? "Chargement…" : `${jobCount} offre${jobCount !== 1 ? "s" : ""}`}
            </span>
            {#if totalNew > 0}
              <span
                class="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 leading-none"
              >
                {formatBadge(totalNew)}
              </span>
            {/if}
            <ChevronDown size={14} />
          </span>
        </button>
        {#if showingScope}
          <div
            class="absolute z-50 top-[calc(var(--bar)+0.5rem)] left-0 right-0 max-h-[calc(100%-var(--bar)-1rem)] overflow-y-auto
                   pointer-events-auto flex flex-col gap-1 rounded-xl bg-background shadow-panel p-2"
          >
            {#if savedSearches.length > 0}
              <button
                onclick={() => goTo({ kind: "all" })}
                class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors
                  {view.kind === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
              >
                <span>Tout</span>
                {#if totalNew > 0}
                  <span class="shrink-0 rounded-full bg-background/25 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                    {formatBadge(totalNew)}
                  </span>
                {/if}
              </button>
            {/if}
            {#each savedSearches as s (s.id)}
              <button
                onclick={() => goTo({ kind: "saved", id: s.id })}
                class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors
                  {view.kind === 'saved' && view.id === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
              >
                <span class="truncate {s.archived ? 'text-muted-foreground italic' : ''}">
                  {s.name}{s.archived ? " (supprimée)" : ""}
                </span>
                {#if (s.newResultsCount ?? 0) > 0}
                  <span class="shrink-0 rounded-full bg-background/25 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                    {formatBadge(s.newResultsCount ?? 0)}
                  </span>
                {/if}
              </button>
            {/each}
            <button
              onclick={() => goTo({ kind: "new" })}
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors
                {view.kind === 'new' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
            >
              <Search size={15} />
              Nouvelle recherche
            </button>
          </div>
        {/if}
      </div>
      {#if onRequestRefresh}
        <button
          onclick={() => onRequestRefresh?.()}
          disabled={refreshState !== "idle"}
          aria-label={refreshLabel}
          title={refreshLabel}
          class="shrink-0 border rounded-lg px-3 py-2 transition-colors hover:bg-muted
                 disabled:cursor-not-allowed disabled:opacity-100"
        >
          <RefreshCw size={16} class={refreshState === "running" ? "animate-spin" : ""} />
        </button>
      {/if}
      <div class="shrink-0">
        {#if activeSearch && !activeSearch.archived}
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
          <div class="absolute z-50 top-[calc(var(--bar)+0.5rem)] right-0 max-h-[calc(100%-var(--bar)-1rem)] overflow-y-auto">
            <SearchEditor
              bind:name={editorName}
              bind:query={editorQuery}
              bind:location={editorLocation}
              title={editing.id === null
                ? "Enregistrer cette recherche"
                : "Modifier la recherche"}
              submitLabel={editing.id === null ? "Enregistrer" : "Mettre à jour"}
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

      <div class="shrink-0">
        <button
          onclick={toggleSettings}
          class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingSettings ? 'bg-muted' : ''}"
        >
          <Settings size={16} />
        </button>
        {#if showingSettings}
          <div class="absolute z-50 top-[calc(var(--bar)+0.5rem)] right-0 max-h-[calc(100%-var(--bar)-1rem)] overflow-y-auto">
            <SettingsPanel
              bind:skills
              bind:radiusKm
              bind:autoScrapeEnabled
              bind:autoScrapeIntervalMinutes
              onClose={() => (showingSettings = false)}
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
          <Star size={16} />
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
    {:else}
      <div class="flex flex-wrap items-center gap-1.5">
        {#each statusChips as chip (chip.value)}
          <button
            class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors
              {status === chip.value
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted text-muted-foreground'}"
            onclick={() => (status = chip.value)}
          >
            {chip.label}
          </button>
        {/each}
        <button
          class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors border
            {hideViewed ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}"
          onclick={() => (hideViewed = !hideViewed)}
        >
          Non lues uniquement
        </button>
        <select
          bind:value={daysFilter}
          class="border rounded-full px-2.5 py-1 text-xs bg-background text-muted-foreground outline-none"
        >
          {#each dateOptions as opt (opt.label)}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <select
          bind:value={source}
          class="border rounded-full px-2.5 py-1 text-xs bg-background text-muted-foreground outline-none"
        >
          <option value={null}>Tous les boards</option>
          {#each sources as s (s)}
            <option value={s}>{READABLE_SOURCES[s]}</option>
          {/each}
        </select>
        <input
          type="text"
          placeholder="Entreprise"
          bind:value={company}
          class="min-w-0 w-28 border rounded-full px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          bind:value={sortMode}
          class="border rounded-full px-2.5 py-1 text-xs bg-background text-muted-foreground outline-none"
        >
          <option value="date">Tri : Date</option>
          <option value="score">Tri : Pertinence</option>
        </select>
        {#if hasActiveFilters}
          <button
            onclick={clearFilters}
            class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Effacer les filtres
          </button>
        {/if}
      </div>
    {/if}
  {/if}
</div>
