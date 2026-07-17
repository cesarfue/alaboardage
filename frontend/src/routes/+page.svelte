<script lang="ts">
  import { page } from "$app/state";
  import { api } from "$lib/api";
  import type { InteractionStatus, Job, SavedSearch, Skill } from "$lib/types";
  import { scoreJob } from "$lib/scoring";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { MapLibre, GeoJSON, CircleLayer, SymbolLayer } from "svelte-maplibre";
  import { Search } from "@lucide/svelte";
  import type { LayerClickInfo } from "svelte-maplibre";
  import type { GeoJSONSource } from "maplibre-gl";
  import type maplibregl from "maplibre-gl";
  import type { FeatureCollection, Feature, Point } from "geojson";
  import JobList from "$lib/components/JobList.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import JobDetail from "$lib/components/JobDetail.svelte";
  import { getToken, setToken } from "$lib/auth";
  import { userState } from "$lib/user.svelte";
  import { normalizeText } from "$lib/utils";

  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  let jobs = $state<Job[]>([]);
  let searching = $state(false);
  let center = $state<[number, number]>([2.35, 48.85]);
  let zoom = $state(6);
  let closeStream: (() => void) | null = null;
  let streamGeneration = 0;
  let skills = $state<Skill[]>([]);
  let skillsReady = $state(false);
  let savedSearches = $state<SavedSearch[]>([]);

  // Filter state
  let radiusKm = $state(60);
  let daysFilter = $state<number | null>(30);
  let statusFilter = $state<InteractionStatus | null>(null);
  let searchCenter = $state<[number, number] | null>(null); // [lat, lng]

  async function geocodeLocation(
    loc: string,
  ): Promise<[number, number] | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`,
        { headers: { "Accept-Language": "fr" } },
      );
      const data: { lat: string; lon: string }[] = await res.json();
      if (data.length > 0)
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch {
      /* ignore */
    }
    return null;
  }

  async function reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "fr" } },
      );
      const data: { address?: Record<string, string | undefined> } =
        await res.json();
      const a = data.address ?? {};
      return a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? null;
    } catch {
      /* ignore */
    }
    return null;
  }

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
    api
      .setSkills(skills)
      .catch((e: unknown) => console.error("setSkills failed", e));
  });

  onMount(async () => {
    // Capture OAuth token first — before any API call
    // (page onMount fires before layout onMount in Svelte; capturing here ensures
    // the token is in localStorage before api.getSkills() runs)
    const tokenParam = new URLSearchParams(window.location.search).get("token");
    if (tokenParam) {
      setToken(tokenParam);
      userState.refresh();
      // Remove token from URL — preserve SvelteKit's history.state to avoid router conflict
      const clean =
        window.location.pathname +
        window.location.search
          .replace(/[?&]token=[^&]*/, "")
          .replace(/^&/, "?");
      window.history.replaceState(window.history.state, "", clean);
    }

    try {
      const remote = await api.getSkills();
      skills =
        remote.length > 0
          ? remote
          : JSON.parse(localStorage.getItem("skills") ?? "[]");
    } catch {
      try {
        skills = JSON.parse(localStorage.getItem("skills") ?? "[]");
      } catch {
        /* ignore corrupt localStorage */
      }
    }
    skillsReady = true;

    // Load interactions and build map
    try {
      const interactions = await api.getInteractions();
      const map = new Map<string, InteractionStatus>();
      for (const { jobId, status } of interactions) map.set(jobId, status);
      interactionsMap = map;
    } catch {
      /* non-blocking */
    }

    // Load saved searches (only if authenticated)
    if (getToken()) {
      try {
        savedSearches = await api.getSavedSearches();
      } catch {
        /* non-blocking */
      }
    }

    if (query || location) {
      // Geocode on initial page load so radius filter uses the searched city, not the map center
      if (location) {
        geocodeLocation(location).then((coords) => {
          if (!coords) return;
          searchCenter = coords;
          center = [coords[1], coords[0]]; // MapLibre: [lng, lat]
          zoom = 10;
        });
      }

      searching = true;
      try {
        const res = await api.listJobs({
          query: query || undefined,
          location: location || undefined,
          limit: 200,
        });
        jobs = res.items.map((j) =>
          interactionsMap.has(j.id)
            ? { ...j, interactionStatus: interactionsMap.get(j.id) }
            : j,
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

  function haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
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

  // Hoist title-filter word list: computed once per query change, not per job
  const titleWords = $derived(
    query.trim() ? query.trim().split(/\s+/).map(normalizeText) : [],
  );

  let filteredJobs = $derived(
    mappedJobs.filter((j) => {
      // Radius filter — use geocoded searchCenter when available, else map center
      if (radiusKm < 500) {
        const refLat = searchCenter ? searchCenter[0] : center[1];
        const refLng = searchCenter ? searchCenter[1] : center[0];
        const dist = haversineKm(
          refLat,
          refLng,
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
      if (statusFilter !== null && j.interactionStatus !== statusFilter)
        return false;

      // Title keyword filter — every word of the query must appear in the job title
      if (titleWords.length > 0) {
        if (!titleWords.every((w) => normalizeText(j.title ?? "").includes(w)))
          return false;
      }

      return true;
    }),
  );

  let activeJob = $state<Job | null>(null);
  let selectedJob = $state<Job | null>(null);
  let map = $state<maplibregl.Map | undefined>(undefined);

  // svelte-maplibre's bind:zoom only updates on zoomend; hook MapLibre's raw
  // `zoom` event to drive the fan-out continuously during pinch/wheel zoom.
  let mapZoomVersion = $state(0);
  $effect(() => {
    const m = map;
    if (!m) return;
    const onZoom = () => mapZoomVersion++;
    m.on("zoom", onZoom);
    return () => {
      m.off("zoom", onZoom);
    };
  });

  const CLUSTER_MAX_ZOOM = 12;
  const COLLISION_PX = 20;
  const MIN_FAN_RADIUS_PX = 14;

  function jobFeature(job: Job, lng: number, lat: number): Feature<Point> {
    return {
      type: "Feature",
      id: job.id,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        id: job.id,
        title: job.title,
        company: job.company,
        isSelected: selectedJob?.id === job.id,
      },
    };
  }

  // Above the clustering threshold, pins are projected to pixel space and
  // groups of collisions (< COLLISION_PX apart) are fanned out on a ring
  // around their pixel centroid, then unprojected. Below the threshold,
  // MapLibre's native clustering already handles overlaps.
  const jobsGeoJSON: FeatureCollection = $derived.by(() => {
    void mapZoomVersion; // subscribe to per-frame zoom updates
    const currentZoom = map?.getZoom() ?? zoom;
    if (currentZoom <= CLUSTER_MAX_ZOOM || !map) {
      return {
        type: "FeatureCollection",
        features: filteredJobs.map((job) =>
          jobFeature(job, job.establishment!.lng, job.establishment!.lat),
        ),
      };
    }

    const projected = filteredJobs.map((job) => ({
      job,
      px: map!.project([job.establishment!.lng, job.establishment!.lat]),
    }));

    const n = projected.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const collision2 = COLLISION_PX * COLLISION_PX;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = projected[i].px.x - projected[j].px.x;
        const dy = projected[i].px.y - projected[j].px.y;
        if (dx * dx + dy * dy < collision2) parent[find(i)] = find(j);
      }
    }

    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const g = groups.get(root);
      if (g) g.push(i);
      else groups.set(root, [i]);
    }

    const features: Feature<Point>[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        const p = projected[group[0]];
        features.push(
          jobFeature(p.job, p.job.establishment!.lng, p.job.establishment!.lat),
        );
        continue;
      }
      let cx = 0;
      let cy = 0;
      for (const idx of group) {
        cx += projected[idx].px.x;
        cy += projected[idx].px.y;
      }
      cx /= group.length;
      cy /= group.length;
      const ringRadius = Math.max(
        MIN_FAN_RADIUS_PX,
        (COLLISION_PX * group.length) / (2 * Math.PI),
      );
      group.forEach((idx, i) => {
        const angle = (i / group.length) * 2 * Math.PI - Math.PI / 2;
        const px = cx + Math.cos(angle) * ringRadius;
        const py = cy + Math.sin(angle) * ringRadius;
        const ll = map!.unproject([px, py]);
        features.push(jobFeature(projected[idx].job, ll.lng, ll.lat));
      });
    }
    return { type: "FeatureCollection", features };
  });

  async function onClusterClick(e: LayerClickInfo) {
    if (!e.features?.length || !e.map) return;
    const clusterId = e.features[0].properties?.cluster_id as number;
    const coords = (e.features[0].geometry as Point).coordinates as [
      number,
      number,
    ];
    const source = e.map.getSource("jobs-source") as GeoJSONSource | undefined;
    if (!source) return;
    try {
      const expansionZoom = await source.getClusterExpansionZoom(clusterId);
      e.map.easeTo({
        center: coords,
        zoom: Math.max(expansionZoom, e.map.getZoom() + 1),
      });
    } catch {
      /* ignore */
    }
  }

  function onPointClick(e: LayerClickInfo) {
    if (!e.features?.length) return;
    const jobId = e.features[0].properties?.id as string;
    const job = filteredJobs.find((j) => j.id === jobId);
    if (!job) return;
    selectedJob = job;
    activeJob = job;
    if (job.establishment) {
      map?.easeTo({
        center: [job.establishment.lng, job.establishment.lat],
        padding: { left: 760, top: 0, right: 0, bottom: 0 },
      });
    }
  }

  function startStream(opts: { skipGeocode?: boolean } = {}) {
    closeStream?.();
    const gen = ++streamGeneration;
    jobs = [];
    searching = true;
    if (opts.skipGeocode) {
      // Caller has already set searchCenter/center — leave zoom untouched.
    } else if (location) {
      geocodeLocation(location).then((coords) => {
        if (gen !== streamGeneration || !coords) return;
        searchCenter = coords;
        center = [coords[1], coords[0]]; // MapLibre uses [lng, lat]
        zoom = 10;
      });
    } else {
      searchCenter = null;
    }
    closeStream = api.streamSearch(
      { query: query || undefined, location: location || undefined },
      (job) => {
        if (gen !== streamGeneration) return;
        // Each job arrives fully enriched (establishment + score already set).
        const withStatus = interactionsMap.has(job.id)
          ? { ...job, interactionStatus: interactionsMap.get(job.id) }
          : job;
        jobs = [...jobs, withStatus];
      },
      () => {
        if (gen !== streamGeneration) return;
        searching = false;
        closeStream = null;
      },
      () => {
        if (gen !== streamGeneration) return;
        toast.error("Erreur lors de la recherche");
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

  // Show "Search this area" button when the map center has moved outside the
  // current search radius. Hidden when no search yet (searchCenter === null).
  const isOutsideSearchZone = $derived(
    searchCenter !== null &&
      haversineKm(searchCenter[0], searchCenter[1], center[1], center[0]) >
        radiusKm,
  );

  async function searchThisArea() {
    // Snapshot map center; user may keep panning during reverse-geocode.
    const [lng, lat] = center;
    const newSearchCenter: [number, number] = [lat, lng];
    const place = await reverseGeocode(lat, lng);
    location = place ?? `Autour de ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    searchCenter = newSearchCenter;
    const urlParams = new URLSearchParams();
    if (query) urlParams.set("query", query);
    if (location) urlParams.set("location", location);
    goto(`?${urlParams}`);
    startStream({ skipGeocode: true });
  }

  function applyInteraction(
    jobId: string,
    status: InteractionStatus | undefined,
  ) {
    // Update interactionsMap
    const newMap = new Map(interactionsMap);
    if (status === undefined) {
      newMap.delete(jobId);
    } else {
      newMap.set(jobId, status);
    }
    interactionsMap = newMap;

    // Update jobs array
    jobs = jobs.map((j) =>
      j.id === jobId ? { ...j, interactionStatus: status } : j,
    );

    // Update selectedJob if it's the same
    if (selectedJob?.id === jobId) {
      selectedJob = { ...selectedJob, interactionStatus: status };
    }
  }
</script>

<main class="relative w-full h-screen overflow-hidden">
  <TopBar
    bind:query
    bind:location
    {search}
    {searching}
    bind:skills
    bind:savedSearches
    bind:radiusKm
    bind:daysFilter
  />
  <MapLibre
    style="https://tiles.openfreemap.org/styles/liberty"
    class="w-full h-full"
    bind:center
    bind:zoom
    bind:map
  >
    <GeoJSON
      id="jobs-source"
      data={jobsGeoJSON}
      cluster={{ maxZoom: CLUSTER_MAX_ZOOM, radius: 50 }}
    >
      <CircleLayer
        id="clusters"
        filter={["has", "point_count"]}
        paint={{
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#64748b",
            5,
            "#3b82f6",
            20,
            "#8b5cf6",
          ],
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 22, 20, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        }}
        hoverCursor="pointer"
        onclick={onClusterClick}
      />
      <SymbolLayer
        id="cluster-count"
        filter={["has", "point_count"]}
        layout={{ "text-field": "{point_count_abbreviated}", "text-size": 13 }}
        paint={{ "text-color": "#fff" }}
      />
      <CircleLayer
        id="unclustered-point"
        filter={["!", ["has", "point_count"]]}
        paint={{
          "circle-color": [
            "case",
            ["boolean", ["get", "isSelected"], false],
            "#ef4444",
            "#3b82f6",
          ],
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        }}
        hoverCursor="pointer"
        onclick={onPointClick}
      />
    </GeoJSON>
  </MapLibre>
  {#if isOutsideSearchZone}
    <button
      onclick={searchThisArea}
      disabled={searching}
      class="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto
             flex items-center gap-2 bg-background border rounded-full
             px-4 py-2 text-sm font-medium shadow-lg
             hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Search size={14} />
      Rechercher dans cette zone
    </button>
  {/if}
  <div class="absolute bottom-10 top-30 left-10 z-10 flex flex-row gap-4">
    <JobList
      jobs={filteredJobs}
      {skills}
      {activeJob}
      selectedJobId={selectedJob?.id ?? null}
      bind:statusFilter
      onSelect={(job) => {
        selectedJob = job;
        activeJob = job;
        if (job?.establishment)
          map?.easeTo({
            center: [job.establishment.lng, job.establishment.lat],
            padding: { left: 760, top: 0, right: 0, bottom: 0 },
          });
      }}
      onHover={(job) => (activeJob = job)}
    />
    {#if selectedJob !== null}
      <JobDetail
        job={selectedJob}
        {applyInteraction}
        onClose={() => (selectedJob = null)}
      />
    {/if}
  </div>
</main>
