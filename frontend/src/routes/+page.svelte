<script lang="ts">
  import { page } from "$app/state";
  import { api } from "$lib/api";
  import type { InteractionStatus, Job, SavedSearch, Skill } from "$lib/types";
  import { scoreJob } from "$lib/scoring";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { MapLibre, Marker } from "svelte-maplibre";
  import type maplibregl from "maplibre-gl";
  import JobList from "$lib/components/JobList.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import JobDetail from "$lib/components/JobDetail.svelte";
  import { setToken, getToken } from "$lib/auth";


  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  let jobs = $state<Job[]>([]);
  let searching = $state(false);
  let center = $state<[number, number]>([2.35, 48.85]);
  let zoom = $state(6);
  let closeStream: (() => void) | null = null;
  let skills = $state<Skill[]>([]);
  let skillsReady = $state(false);
  let savedSearches = $state<SavedSearch[]>([]);

  // Filter state
  let radiusKm = $state(60);
  let daysFilter = $state<number | null>(30);
  let statusFilter = $state<InteractionStatus | null>(null);

  // Interactions map: jobId → status (source of truth for status merging)
  let interactionsMap = $state<Map<string, InteractionStatus>>(new Map());

  $effect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      center = [pos.coords.longitude, pos.coords.latitude];
      zoom = 10;
    });
  });

  $effect(() => {
    if (!skillsReady) return;
    localStorage.setItem("skills", JSON.stringify(skills));
    api.setSkills(skills).catch((e: unknown) => console.error("setSkills failed", e));
  });

  onMount(async () => {
    // Capture token from OAuth redirect before any API calls
    const tokenParam = new URLSearchParams(window.location.search).get("token");
    if (tokenParam) {
      setToken(tokenParam);
      history.replaceState(null, "", window.location.pathname);
    }

    try {
      const remote = await api.getSkills();
      skills = remote.length > 0
        ? remote
        : JSON.parse(localStorage.getItem("skills") ?? "[]");
    } catch {
      try { skills = JSON.parse(localStorage.getItem("skills") ?? "[]"); } catch { /* ignore corrupt localStorage */ }
    }
    skillsReady = true;

    // Load interactions and build map
    try {
      const interactions = await api.getInteractions();
      const map = new Map<string, InteractionStatus>();
      for (const { jobId, status } of interactions) map.set(jobId, status);
      interactionsMap = map;
    } catch { /* non-blocking */ }

    // Load saved searches (only if authenticated)
    if (getToken()) {
      try {
        savedSearches = await api.getSavedSearches();
      } catch { /* non-blocking */ }
    }

    if (query || location) {
      searching = true;
      try {
        const res = await api.listJobs({
          query: query || undefined,
          location: location || undefined,
          limit: 200,
        });
        jobs = res.items.map((j) =>
          interactionsMap.has(j.id) ? { ...j, interactionStatus: interactionsMap.get(j.id) } : j
        );
      } catch {
        toast.error("Impossible de charger les résultats");
      } finally {
        searching = false;
      }
    }
  });

  let sortedJobs = $derived(
    [...jobs].sort((a, b) => scoreJob(b, skills) - scoreJob(a, skills)),
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

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  let filteredJobs = $derived(
    mappedJobs.filter((j) => {
      // Radius filter — center is [lng, lat], haversine wants lat first
      if (radiusKm < 500) {
        const dist = haversineKm(
          center[1],
          center[0],
          j.establishment!.lat,
          j.establishment!.lng,
        );
        if (dist > radiusKm) return false;
      }

      // Date filter — jobs without a valid datePosted are included
      if (daysFilter !== null) {
        const d = new Date(j.datePosted);
        if (!isNaN(d.getTime())) {
          const cutoff = Date.now() - daysFilter * 24 * 60 * 60 * 1000;
          if (d.getTime() < cutoff) return false;
        }
      }

      // Status filter
      if (statusFilter !== null && j.interactionStatus !== statusFilter) return false;

      return true;
    }),
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
        const withStatus = interactionsMap.has(job.id)
          ? { ...job, interactionStatus: interactionsMap.get(job.id) }
          : job;
        jobs = [...jobs, withStatus];
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

  function applyInteraction(jobId: string, status: InteractionStatus | undefined) {
    // Update interactionsMap
    const newMap = new Map(interactionsMap);
    if (status === undefined) {
      newMap.delete(jobId);
    } else {
      newMap.set(jobId, status);
    }
    interactionsMap = newMap;

    // Update jobs array
    jobs = jobs.map((j) => (j.id === jobId ? { ...j, interactionStatus: status } : j));

    // Update selectedJob if it's the same
    if (selectedJob?.id === jobId) {
      selectedJob = { ...selectedJob, interactionStatus: status };
    }
  }
</script>

<main class="relative w-full h-screen overflow-hidden">
  <TopBar bind:query bind:location {search} {searching} bind:skills bind:savedSearches bind:radiusKm bind:daysFilter />
  <MapLibre
    style="https://tiles.openfreemap.org/styles/liberty"
    class="w-full h-full"
    bind:center
    bind:zoom
    bind:map
  >
    {#each filteredJobs as job (job.id)}
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
      jobs={filteredJobs}
      {skills}
      {activeJob}
      bind:statusFilter
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
      <JobDetail job={selectedJob} {applyInteraction} onClose={() => (selectedJob = null)} />
    {/if}
  </div>
</main>
