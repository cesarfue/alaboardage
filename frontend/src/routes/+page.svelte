<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { page } from "$app/state";
  import { api, ApiError } from "$lib/api";
  import type { Job } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { READABLE_SOURCES } from "$lib/types";
  import { List, Map } from "@lucide/svelte";
  import { MapLibre, Marker, Popup } from "svelte-maplibre";

  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  let jobs = $state<Job[]>([]);
  let view = $state<"list" | "map">("list");
  let center = $state<[number, number]>([2.35, 48.85]);
  let zoom = $state(6);

  $effect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      center = [pos.coords.longitude, pos.coords.latitude];
      zoom = 10;
    });
  });

  $effect(() => {
    const q = page.url.searchParams.get("query") ?? "";
    const loc = page.url.searchParams.get("location") ?? "";
    api
      .listJobs({ query: q || undefined, location: loc || undefined })
      .then((res) => {
        jobs = res.items;
      });
  });

  async function search() {
    const params = { query: query || undefined, location: location || undefined };
    api.listJobs(params).then((res) => (jobs = res.items));
    try {
      await api.search(params);
    } catch (e) {
      toast.error(
        e instanceof ApiError ? `Erreur ${e.status}` : "Erreur inattendue",
      );
    } finally {
      const urlParams = new URLSearchParams();
      if (query) urlParams.set("query", query);
      if (location) urlParams.set("location", location);
      goto(`?${urlParams}`);
      const res = await api.listJobs(params);
      jobs = res.items;
    }
  }
</script>

<div class="flex h-screen">
  <aside class="w-64 shrink-0 p-4 border-r flex flex-col gap-2">
    <input
      type="text"
      placeholder="Poste"
      bind:value={query}
      class="border rounded px-2 py-1 text-sm"
    />
    <input
      type="text"
      placeholder="Lieu"
      bind:value={location}
      class="border rounded px-2 py-1 text-sm"
    />
    <button
      onclick={search}
      class="bg-primary text-primary-foreground rounded px-3 py-1 text-sm"
    >
      Rechercher
    </button>
  </aside>

  <main class="relative flex-1 min-w-0 overflow-hidden">
    {#if view === "list"}
      <div class="h-full overflow-auto p-4">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Titre</Table.Head>
              <Table.Head>Entreprise</Table.Head>
              <Table.Head>Lieu</Table.Head>
              <Table.Head>Source</Table.Head>
              <Table.Head>Date</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each jobs as job (job.id)}
              <Table.Row>
                <Table.Cell class="font-medium max-w-64 truncate">{job.title}</Table.Cell>
                <Table.Cell class="max-w-40 truncate">{job.company}</Table.Cell>
                <Table.Cell class="max-w-40 truncate">{job.location}</Table.Cell>
                <Table.Cell>{READABLE_SOURCES[job.source]}</Table.Cell>
                <Table.Cell>{job.datePosted.split("T")[0]}</Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {:else}
      <MapLibre
        style="https://tiles.openfreemap.org/styles/liberty"
        class="w-full h-full"
        standardControls
        bind:center
        bind:zoom
      >
        {#each jobs.filter((j) => j.establishment) as job (job.id)}
          <Marker lngLat={[job.establishment!.lng, job.establishment!.lat]} asButton>
            <div class="w-3 h-3 rounded-full bg-primary border-2 border-white shadow-md cursor-pointer"></div>
            <Popup offset={[0, -10]}>
              <div class="p-1 text-sm">
                <p class="font-semibold">{job.title}</p>
                <p class="text-muted-foreground">{job.company}</p>
              </div>
            </Popup>
          </Marker>
        {/each}
      </MapLibre>
    {/if}

    <div
      class="absolute bottom-6 left-1/2 -translate-x-1/2 flex rounded-full border bg-background shadow-lg overflow-hidden"
    >
      <button
        onclick={() => (view = "list")}
        class="flex items-center gap-1.5 px-4 py-2 text-sm transition-colors
               {view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
      >
        <List size={16} />
        Liste
      </button>
      <button
        onclick={() => (view = "map")}
        class="flex items-center gap-1.5 px-4 py-2 text-sm transition-colors
               {view === 'map' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
      >
        <Map size={16} />
        Carte
      </button>
    </div>
  </main>
</div>
