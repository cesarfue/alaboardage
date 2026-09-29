<script lang="ts">
  import { ClipboardList, Layers, Search, X } from "@lucide/svelte";
  import type { SavedSearch, View } from "$lib/types";

  let {
    view,
    savedSearches,
    onSelect,
    onClose,
  }: {
    view: View;
    savedSearches: SavedSearch[];
    onSelect: (v: View) => void;
    onClose: () => void;
  } = $props();

  function formatBadge(n: number): string {
    return n > 99 ? "99+" : String(n);
  }

  function itemClass(active: boolean): string {
    return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
    }`;
  }
</script>

<div
  class="pointer-events-auto w-[min(300px,calc(100vw-1.5rem))] flex flex-col gap-1 rounded-xl bg-background shadow-panel p-2"
>
  <div class="flex items-center justify-between px-2 py-1">
    <h2 class="font-semibold text-sm">Recherches</h2>
    <button onclick={onClose} class="text-muted-foreground hover:text-foreground">
      <X size={16} />
    </button>
  </div>

  {#if savedSearches.length > 0}
    <button
      onclick={() => onSelect({ kind: "all" })}
      class={itemClass(view.kind === "all")}
    >
      <Layers size={15} />
      Tout
    </button>
  {/if}

  {#each savedSearches as s (s.id)}
    <button
      onclick={() => onSelect({ kind: "saved", id: s.id })}
      class={itemClass(view.kind === "saved" && view.id === s.id) + " justify-between"}
    >
      <span class="truncate">{s.name}</span>
      {#if (s.newResultsCount ?? 0) > 0}
        <span
          class="shrink-0 rounded-full bg-background/25 text-[10px] font-semibold px-1.5 py-0.5 leading-none"
        >
          {formatBadge(s.newResultsCount ?? 0)}
        </span>
      {/if}
    </button>
  {/each}

  <button
    onclick={() => onSelect({ kind: "new" })}
    class={itemClass(view.kind === "new")}
  >
    <Search size={15} />
    Nouvelle recherche
  </button>

  <button
    onclick={() => onSelect({ kind: "suivi" })}
    class={itemClass(view.kind === "suivi")}
  >
    <ClipboardList size={15} />
    Suivi
  </button>
</div>
