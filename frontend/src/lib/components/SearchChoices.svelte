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
  class="absolute top-3 right-3 z-20 pointer-events-auto
         flex flex-col gap-2 rounded-xl border bg-background/95 backdrop-blur p-3 shadow-lg w-64"
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
    onkeydown={(e) => e.key === 'Enter' && search()}
  />
  <button
    onclick={search}
    disabled={searching}
    class="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
  >
    {searching ? "Recherche…" : "Rechercher"}
  </button>
</div>
