<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { page } from "$app/state";
  import { api } from "$lib/api";
  import type { Job } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { READABLE_SOURCES } from "$lib/types";
  import { untrack } from "svelte";
  import { List, Map, X, ExternalLink } from "@lucide/svelte";
  import { MapLibre, Marker, Popup } from "svelte-maplibre";

  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  let jobs = $state<Job[]>([]);
  let searching = $state(false);
  let view = $state<"list" | "map">("list");
  let center = $state<[number, number]>([2.35, 48.85]);
  let zoom = $state(6);
  let closeStream: (() => void) | null = null;
  let selectedJob = $state<Job | null>(null);

  $effect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      center = [pos.coords.longitude, pos.coords.latitude];
      zoom = 10;
    });
  });

  // Drives the stream from the URL: runs once per query/location change,
  // covering both reload (params already set) and search() (goto updates them).
  $effect(() => {
    const q = page.url.searchParams.get("query") ?? "";
    const loc = page.url.searchParams.get("location") ?? "";
    if (q || loc) {
      untrack(() => {
        query = q;
        location = loc;
        startStream();
      });
    }
  });

  function startStream() {
    closeStream?.();
    jobs = [];
    searching = true;
    closeStream = api.streamSearch(
      { query: query || undefined, location: location || undefined },
      (job) => { jobs = [...jobs, job]; },
      () => { searching = false; closeStream = null; },
      () => { toast.error("Erreur lors de la recherche"); },
      (jobId, establishment) => {
        jobs = jobs.map((j) => j.id === jobId ? { ...j, establishment } : j);
      },
    );
  }

  function search() {
    const urlParams = new URLSearchParams();
    if (query) urlParams.set("query", query);
    if (location) urlParams.set("location", location);
    goto(`?${urlParams}`);
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
      disabled={searching}
      class="bg-primary text-primary-foreground rounded px-3 py-1 text-sm disabled:opacity-50"
    >
      {searching ? "Recherche…" : "Rechercher"}
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
              <Table.Row
                onclick={() => (selectedJob = job)}
                class="cursor-pointer"
              >
                <Table.Cell class="font-medium max-w-64 truncate"
                  >{job.title}</Table.Cell
                >
                <Table.Cell class="max-w-40 truncate">{job.company}</Table.Cell>
                <Table.Cell class="max-w-40 truncate">{job.location}</Table.Cell
                >
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
        {#each jobs.filter((j) => j.establishment && j.establishment.lat != null && !isNaN(j.establishment.lat) && j.establishment.lng != null && !isNaN(j.establishment.lng)) as job (job.id)}
          <Marker
            lngLat={[job.establishment!.lng, job.establishment!.lat]}
            asButton
          >
            <div
              class="w-3 h-3 rounded-full bg-primary border-2 border-white shadow-md cursor-pointer"
            ></div>
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
      class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex rounded-full border bg-background shadow-lg overflow-hidden"
    >
      <button
        onclick={() => (view = "list")}
        class="flex items-center gap-1.5 px-4 py-2 text-sm transition-colors
               {view === 'list'
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'}"
      >
        <List size={16} />
        Liste
      </button>
      <button
        onclick={() => (view = "map")}
        class="flex items-center gap-1.5 px-4 py-2 text-sm transition-colors
               {view === 'map'
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'}"
      >
        <Map size={16} />
        Carte
      </button>
    </div>
  </main>

  {#if selectedJob}
    <aside class="w-[420px] shrink-0 border-l flex flex-col h-screen">
      <div class="flex items-start justify-between p-4 border-b gap-2">
        <div class="min-w-0">
          <p class="font-semibold text-sm leading-snug">{selectedJob.title}</p>
          <p class="text-muted-foreground text-sm truncate">{selectedJob.company} · {selectedJob.location}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <a href={selectedJob.url} target="_blank" rel="noopener noreferrer"
            class="p-1.5 rounded hover:bg-muted transition-colors">
            <ExternalLink size={16} />
          </a>
          <button onclick={() => (selectedJob = null)} class="p-1.5 rounded hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2 px-4 py-2 border-b text-xs text-muted-foreground">
        <span>{READABLE_SOURCES[selectedJob.source]}</span>
        <span>·</span>
        <span>{selectedJob.datePosted.split("T")[0]}</span>
      </div>
      <div class="flex-1 overflow-y-auto p-4 text-sm leading-relaxed prose prose-sm max-w-none">
        {@html selectedJob.description}
      </div>
    </aside>
  {/if}
</div>
