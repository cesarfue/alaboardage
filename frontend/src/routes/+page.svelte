<script lang="ts">
  import { page } from "$app/state";
  import { api } from "$lib/api";
  import type { Job } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { MapLibre, Marker, Popup } from "svelte-maplibre";
  import JobList from "$lib/components/JobList.svelte";
  import SearchChoices from "$lib/components/SearchChoices.svelte";

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

  onMount(() => {
    if (query || location) startStream();
  });

  let mappedJobs = $derived(
    jobs.filter(
      (j) =>
        j.establishment &&
        j.establishment.lat != null &&
        !isNaN(j.establishment.lat) &&
        j.establishment.lng != null &&
        !isNaN(j.establishment.lng),
    ),
  );

  let activeId = $state<string | null>(null);

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
    startStream();
  }
</script>

<main class="relative w-full h-screen overflow-hidden">
  <SearchChoices bind:query bind:location {search} {searching} />
  <MapLibre
    style="https://tiles.openfreemap.org/styles/liberty"
    class="w-full h-full"
    standardControls
    bind:center
    bind:zoom
  >
    {#each mappedJobs as job (job.id)}
      <Marker
        lngLat={[job.establishment!.lng, job.establishment!.lat]}
        asButton
      >
        <div
          class="w-3 h-3 rounded-full {activeId === job.id
            ? 'bg-red-500'
            : 'bg-primary'} border-2 border-white shadow-md cursor-pointer"
        ></div>
        <Popup offset={[0, -10]} openOn="manual" open={activeId === job.id}>
          <div class="p-1 text-sm">
            <p class="font-semibold">{job.title}</p>
            <p class="text-muted-foreground">{job.company}</p>
          </div>
        </Popup>
      </Marker>
    {/each}
  </MapLibre>
  <JobList
    jobs={mappedJobs}
    {activeId}
    onSelect={(id) => {
      activeId = id;
      const job = mappedJobs.find((j) => j.id === id);
      if (job?.establishment)
        center = [job.establishment.lng, job.establishment.lat];
    }}
    onHover={(id) => (activeId = id)}
  />
</main>
