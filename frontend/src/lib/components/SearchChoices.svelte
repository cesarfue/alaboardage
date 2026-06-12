<script lang="ts">
  let {
    query = $bindable(),
    location = $bindable(),
    search,
    searching,
  }: {
    query: string;
    location: string;
    search: () => void;
    searching: boolean;
  } = $props();
</script>

<div
  class="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto
         flex flex-row items-center gap-2 rounded-xl p-3"
>
  <input
    type="text"
    placeholder="Poste"
    bind:value={query}
    class="border rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
  />
  <input
    type="text"
    placeholder="Lieu"
    bind:value={location}
    class="border rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
    onkeydown={(e) => e.key === "Enter" && search()}
  />
  <button
    onclick={search}
    disabled={searching}
    class="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
  >
    {searching ? "Recherche…" : "Rechercher"}
  </button>
</div>
