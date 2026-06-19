<script lang="ts">
  import { page } from "$app/state";
  import { api } from "$lib/api";
  import type { Job, Skill } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { MapLibre, Marker } from "svelte-maplibre";
  import type maplibregl from "maplibre-gl";
  import JobList from "$lib/components/JobList.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import JobDetail from "$lib/components/JobDetail.svelte";
  import ProfilePanel from "$lib/components/ProfilePanel.svelte";

  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  let jobs = $state<Job[]>([]);
  let searching = $state(false);
  let center = $state<[number, number]>([2.35, 48.85]);
  let zoom = $state(6);
  let closeStream: (() => void) | null = null;
  let showingFilters = $state(false);
  let showingProfile = $state(false);
  let skills = $state<Skill[]>([]);
  let skillsReady = $state(false);

  $effect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      center = [pos.coords.longitude, pos.coords.latitude];
      zoom = 10;
    });
  });

  $effect(() => {
    if (!skillsReady) return;
    localStorage.setItem("skills", JSON.stringify(skills));
    api.setSkills(skills).catch(() => {});
  });

  onMount(async () => {
    try {
      const remote = await api.getSkills();
      skills = remote.length > 0
        ? remote
        : JSON.parse(localStorage.getItem("skills") ?? "[]");
    } catch {
      try { skills = JSON.parse(localStorage.getItem("skills") ?? "[]"); } catch { /* ignore corrupt localStorage */ }
    }
    skillsReady = true;

    if (query || location) {
      const res = await api.listJobs({
        query: query || undefined,
        location: location || undefined,
        limit: 200,
      });
      jobs = res.items;
    }
  });

  let sortedJobs = $derived(
    [...jobs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
  );

  let mappedJobs = $derived(
    sortedJobs.filter(
      (j) =>
        j.establishment &&
        j.establishment.lat != null &&
        !isNaN(j.establishment.lat) &&
        j.establishment.lng != null &&
        !isNaN(j.establishment.lng),
    ),
  );

  let activeJob = $state<Job | null>(null);
  let selectedJob = $state<Job | null>(null);
  let map = $state<maplibregl.Map | undefined>(undefined);

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
  <TopBar bind:query bind:location {search} {searching} bind:showingFilters bind:showingProfile />
  {#if showingProfile}
    <div class="absolute top-[60px] right-4 z-10 pointer-events-auto">
      <ProfilePanel bind:skills onClose={() => (showingProfile = false)} />
    </div>
  {/if}
  <MapLibre
    style="https://tiles.openfreemap.org/styles/liberty"
    class="w-full h-full"
    bind:center
    bind:zoom
    bind:map
  >
    {#each mappedJobs as job (job.id)}
      <Marker
        lngLat={[job.establishment!.lng, job.establishment!.lat]}
        asButton
      >
        <div
          class="w-3 h-3 rounded-full {selectedJob?.id === job.id
            ? 'bg-red-500'
            : 'bg-primary'} border-2 border-white shadow-md cursor-pointer"
        ></div>
      </Marker>
    {/each}
  </MapLibre>
  <div class="absolute bottom-10 top-30 left-10 z-10 flex flex-row gap-4">
    <JobList
      jobs={mappedJobs}
      {activeJob}
      onSelect={(job) => {
        selectedJob = job;
        activeJob = job;
        if (job?.establishment)
          map?.easeTo({
            center: [job.establishment.lng, job.establishment.lat],
            padding: { left: 760, top: 0, right: 0, bottom: 0 },
            zoom: 13,
          });
      }}
      onHover={(job) => (activeJob = job)}
    />
    {#if selectedJob !== null}
      <JobDetail job={selectedJob} onClose={() => (selectedJob = null)} />
    {/if}
  </div>
</main>
