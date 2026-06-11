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
  import JobList from "$lib/components/JobList.svelte";

  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  let jobs = $state<Job[]>([]);
  let searching = $state(false);
  let center = $state<[number, number]>([2.35, 48.85]);
  let zoom = $state(6);
  let closeStream: (() => void) | null = null;

  $effect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      center = [pos.coords.longitude, pos.coords.latitude];
      zoom = 10;
    });
  });

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
      (job) => {
        jobs = [...jobs, job];
      },
      () => {
        searching = false;
        closeStream = null;
      },
      () => {
        toast.error("Erreur lors de la recherche");
      },
      (jobId, establishment) => {
        jobs = jobs.map((j) => (j.id === jobId ? { ...j, establishment } : j));
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
  </main>
</div>
