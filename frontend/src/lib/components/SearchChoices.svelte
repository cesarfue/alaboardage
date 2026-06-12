<script lang="ts">
  import { SlidersHorizontal } from "@lucide/svelte";

  let {
    query = $bindable(),
    location = $bindable(),
    search,
    searching,
    showingFilters = $bindable(),
  }: {
    query: string;
    location: string;
    search: () => void;
    searching: boolean;
    showingFilters: boolean;
  } = $props();
</script>

<div
  class="absolute top-10 left-10 z-20 pointer-events-auto
         flex flex-row items-center gap-2 rounded-xl p-3 bg-background"
>
  <input
    type="text"
    placeholder="Poste"
    bind:value={query}
    class="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
  />
  <input
    type="text"
    placeholder="Lieu"
    bind:value={location}
    class="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
    onkeydown={(e) => e.key === "Enter" && search()}
  />
  <button
    onclick={() => (showingFilters = !showingFilters)}
    class="border rounded-lg px-3 transition-colors hover:bg-muted"
  >
    <SlidersHorizontal size={16} />
  </button>
  <button
    onclick={search}
    disabled={searching}
    class="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
  >
    {searching ? "Recherche…" : "Rechercher"}
  </button>
</div>
