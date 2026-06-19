<script lang="ts">
  import { Funnel, User } from "@lucide/svelte";

  let {
    query = $bindable(),
    location = $bindable(),
    search,
    searching,
    showingFilters = $bindable(),
    showingProfile = $bindable(),
  }: {
    query: string;
    location: string;
    search: () => void;
    searching: boolean;
    showingFilters: boolean;
    showingProfile: boolean;
  } = $props();
</script>

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
  <button
    onclick={() => (showingFilters = !showingFilters)}
    class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted"
  >
    <Funnel size={16} />
  </button>
  <button
    onclick={search}
    disabled={searching}
    class="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
  >
    {searching ? "Recherche…" : "Rechercher"}
  </button>
  <button
    onclick={() => (showingProfile = !showingProfile)}
    class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingProfile ? 'bg-muted' : ''}"
  >
    <User size={16} />
  </button>
</div>
