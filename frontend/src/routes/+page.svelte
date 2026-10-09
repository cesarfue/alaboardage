<script lang="ts">
  import { page } from "$app/state";
  import { api } from "$lib/api";
  import type {
    Filters,
    InteractionStatus,
    Job,
    JobSource,
    Preferences,
    RefreshState,
    SavedSearch,
    Skill,
    SortMode,
    View,
  } from "$lib/types";
  import { rankJob } from "$lib/scoring";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { onDestroy, onMount, untrack } from "svelte";
  import { MapLibre, GeoJSON, CircleLayer, SymbolLayer } from "svelte-maplibre";
  import { Info, List, Map as MapIcon, Search } from "@lucide/svelte";
  import type { LayerClickInfo } from "svelte-maplibre";
  import type { GeoJSONSource } from "maplibre-gl";
  import type maplibregl from "maplibre-gl";
  import type { FeatureCollection, Feature, Point } from "geojson";
  import JobList from "$lib/components/JobList.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import JobDetail from "$lib/components/JobDetail.svelte";
  import { normalizeText } from "$lib/utils";

  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  const queries = $derived(query.trim() ? [query.trim()] : []);
  const locations = $derived(location.trim() ? [location.trim()] : []);
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
  let filtersReady = $state(false);
  let autoScrapeEnabled = $state(true);
  let autoScrapeIntervalMinutes = $state(360);
  let source = $state<JobSource | null>(null);
  let company = $state("");
  let status = $state<InteractionStatus | null>(null);
  let sortMode = $state<SortMode>("date");
  let selectedJobIds = $state<Set<string>>(new Set());
  let searchCenter = $state<[number, number] | null>(null); // [lat, lng]

  const WIDE_SCREEN = "(min-width: 768px)";
  let wideScreen = $state(true);
  let mobileView = $state<"map" | "list" | "detail">("map");

  onMount(() => {
    const mql = window.matchMedia(WIDE_SCREEN);
    wideScreen = mql.matches;
    const onChange = (e: MediaQueryListEvent) => (wideScreen = e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  });

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

  let interactionsMap = $state<
    Map<string, { status: InteractionStatus; at: string }>
  >(new Map());

  let viewedIds = $state<Set<string>>(new Set());
  let hideViewed = $state(false);
  let hiddenIds = $state<Set<string>>(new Set());
  let barHeight = $state(0);

  function snapshotHidden() {
    const s = new Set(viewedIds);
    for (const id of interactionsMap.keys()) s.add(id);
    hiddenIds = s;
  }

  $effect(() => {
    if (!hideViewed) return;
    untrack(snapshotHidden);
  });

  $effect(() => {
    const filters: Filters = {
      radiusKm,
      daysFilter,
      hideViewed,
      source,
      company,
      status,
      sortMode,
    };
    if (!filtersReady) return;
    localStorage.setItem("filters", JSON.stringify(filters));
    api.updatePreferences({ filters }).catch(() => {});
  });

  $effect(() => {
    if (!filtersReady) return;
    api
      .updatePreferences({ autoScrapeEnabled, autoScrapeIntervalMinutes })
      .catch(() => {});
  });

  $effect(() => {
    if (!filtersReady) return;
    const currentDaysFilter = daysFilter;
    untrack(() => {
      api
        .getSavedSearches(currentDaysFilter)
        .then((fresh) => (savedSearches = fresh))
        .catch(() => {});
      if (feedNewCount !== null) {
        api
          .getFeed(200, { daysFilter: currentDaysFilter })
          .then((res) => (feedNewCount = res.newCount))
          .catch(() => {});
      }
    });
  });

  function stamp(j: Job): Job {
    const it = interactionsMap.get(j.id);
    const viewed = viewedIds.has(j.id);
    return it
      ? { ...j, interactionStatus: it.status, interactionAt: it.at, viewed }
      : { ...j, viewed };
  }

  function patchTabCache(patch: (j: Job) => Job) {
    savedJobsByTab = new Map(
      [...savedJobsByTab].map(([id, list]) => [id, list.map(patch)]),
    );
  }

  function markViewed(job: Job) {
    if (viewedIds.has(job.id)) return;
    viewedIds = new Set(viewedIds).add(job.id);
    const seen = (j: Job) => (j.id === job.id ? { ...j, viewed: true } : j);
    jobs = jobs.map(seen);
    savedJobs = savedJobs.map(seen);
    patchTabCache(seen);
    api.markViewed(job.id).catch(() => {
      toast.error("Impossible de marquer cette offre comme lue");
    });
  }

  const VIEW_KEY = "lastView";
  const VIEW_KINDS = ["all", "saved", "new"] as const;

  let view = $state<View>({ kind: "new" });
  let savedJobs = $state<Job[]>([]);
  let savedJobsByTab = $state<Map<string, Job[]>>(new Map());
  let savedJobsLoading = $state(false);

  const activeSearch = $derived.by(() => {
    const current = view;
    if (current.kind !== "saved") return null;
    return savedSearches.find((s) => s.id === current.id) ?? null;
  });

  function openView(next: View) {
    snapshotHidden();
    view = next;
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(next));
    } catch {
      view = next;
    }
    api.updatePreferences({ lastView: next }).catch(() => {});
  }

  function restoreView(preferred: View | null) {
    let stored: View | null;
    try {
      stored = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null") as View;
    } catch {
      stored = null;
    }
    for (const candidate of [preferred, stored]) {
      if (!candidate) continue;
      if (!VIEW_KINDS.includes(candidate.kind as (typeof VIEW_KINDS)[number]))
        continue;
      if (candidate.kind === "saved") {
        if (savedSearches.some((s) => s.id === candidate.id)) {
          view = candidate;
          return;
        }
        continue;
      }
      view = candidate;
      return;
    }
    view = savedSearches.length > 0 ? { kind: "all" } : { kind: "new" };
  }

  const ANCHORS_KEY = "listAnchors";
  let listAnchors = $state<Record<string, string>>({});
  let anchorTimer: ReturnType<typeof setTimeout> | null = null;

  function viewKey(v: View): string {
    return v.kind === "saved" ? `saved:${v.id}` : v.kind;
  }

  const currentAnchorKey = $derived(viewKey(view));
  const currentAnchor = $derived(listAnchors[currentAnchorKey] ?? null);

  function localAnchors(): Record<string, string> {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ANCHORS_KEY) ?? "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>;
    } catch {
      return {};
    }
  }

  function rememberAnchor(jobId: string) {
    const tab = viewKey(view);
    if (listAnchors[tab] === jobId) return;
    listAnchors = { ...listAnchors, [tab]: jobId };
    try {
      localStorage.setItem(ANCHORS_KEY, JSON.stringify(listAnchors));
    } catch {
      listAnchors = { ...listAnchors };
    }
    if (anchorTimer) clearTimeout(anchorTimer);
    anchorTimer = setTimeout(() => {
      api.updatePreferences({ anchor: { tab, jobId } }).catch(() => {});
    }, 1000);
  }

  const ALL_TAB = "__all__";
  let feedNewCount = $state<number | null>(null);

  const feedRefreshState = $derived.by((): RefreshState => {
    if (savedSearches.some((s) => s.refreshState === "running")) return "running";
    if (savedSearches.some((s) => s.refreshState === "queued")) return "queued";
    return "idle";
  });

  const bannerCount = $derived(
    view.kind === "all"
      ? (feedNewCount ?? 0)
      : (activeSearch?.newResultsCount ?? 0),
  );
  const bannerRefreshState = $derived(
    view.kind === "all"
      ? feedRefreshState
      : (activeSearch?.refreshState ?? "idle"),
  );
  const bannerLastCheckedAt = $derived.by(() => {
    if (view.kind === "all") {
      const dates = savedSearches
        .map((s) => s.lastCheckedAt)
        .filter((d): d is string => d !== null);
      return dates.length > 0
        ? dates.reduce((latest, d) => (d > latest ? d : latest))
        : null;
    }
    return activeSearch?.lastCheckedAt ?? null;
  });

  function isTabOpen(id: string): boolean {
    if (id === ALL_TAB) return view.kind === "all";
    return view.kind === "saved" && view.id === id;
  }

  async function loadSavedSearchJobs(id: string) {
    const cached = savedJobsByTab.get(id);
    savedJobs = cached ?? [];
    savedJobsLoading = cached === undefined;
    try {
      let fresh: Job[];
      if (id === ALL_TAB) {
        const res = await api.getFeed(200, { daysFilter, source, company, status });
        feedNewCount = res.newCount;
        fresh = res.items.map(stamp);
      } else {
        const res = await api.listSavedSearchJobs(id, 200, {
          daysFilter,
          source,
          company,
          status,
        });
        fresh = res.items.map(stamp);
      }
      savedJobsByTab = new Map(savedJobsByTab).set(id, fresh);
      if (isTabOpen(id)) savedJobs = fresh;
    } catch {
      if (cached === undefined) toast.error("Impossible de charger cette recherche");
    } finally {
      savedJobsLoading = false;
    }
  }

  let refreshPoll: ReturnType<typeof setInterval> | null = null;

  async function pollSearches() {
    try {
      savedSearches = await api.getSavedSearches(daysFilter);
    } catch {
      return;
    }
    const busy = savedSearches.some(
      (s) => s.refreshState === "queued" || s.refreshState === "running",
    );
    if (busy) return;
    if (refreshPoll !== null) {
      clearInterval(refreshPoll);
      refreshPoll = null;
    }
  }

  function startRefreshPoll() {
    if (refreshPoll === null) {
      refreshPoll = setInterval(() => void pollSearches(), 5000);
    }
  }

  async function requestRefresh() {
    try {
      if (view.kind === "all") {
        const { states } = await api.requestFeedRefresh();
        savedSearches = savedSearches.map((s, i) => ({
          ...s,
          refreshState: states[i] ?? s.refreshState,
        }));
        startRefreshPoll();
        return;
      }
      if (!activeSearch) return;
      const id = activeSearch.id;
      const { state } = await api.requestSearchRefresh(id);
      savedSearches = savedSearches.map((s) =>
        s.id === id ? { ...s, refreshState: state } : s,
      );
      startRefreshPoll();
    } catch {
      toast.error("Impossible de lancer le rafraîchissement");
    }
  }

  onDestroy(() => {
    if (refreshPoll !== null) clearInterval(refreshPoll);
  });

  async function showNewResults() {
    snapshotHidden();
    const now = new Date().toISOString();
    if (view.kind === "all") {
      await loadSavedSearchJobs(ALL_TAB);
      feedNewCount = 0;
      savedSearches = savedSearches.map((s) => ({
        ...s,
        newResultsCount: 0,
        lastSeenAt: now,
      }));
      api.markFeedSeen().catch(() => {
        toast.error("Impossible de marquer les recherches comme vues");
      });
      return;
    }
    if (!activeSearch) return;
    const id = activeSearch.id;
    await loadSavedSearchJobs(id);
    savedSearches = savedSearches.map((s) =>
      s.id === id ? { ...s, newResultsCount: 0, lastSeenAt: now } : s,
    );
    api.markSavedSearchSeen(id).catch(() => {
      toast.error("Impossible de marquer cette recherche comme vue");
    });
  }

  $effect(() => {
    const current = view;
    if (current.kind === "new") return;
    untrack(() => {
      if (current.kind === "all") void loadSavedSearchJobs(ALL_TAB);
      else void loadSavedSearchJobs(current.id);
    });
  });

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
      const map = new Map<string, { status: InteractionStatus; at: string }>();
      for (const { jobId, status, updatedAt } of interactions)
        map.set(jobId, { status, at: updatedAt });
      interactionsMap = map;
    } catch {
      /* non-blocking */
    }

    viewedIds = new Set(await api.getViews().catch(() => []));
    snapshotHidden();

    savedSearches = await api.getSavedSearches(daysFilter).catch(() => []);

    const prefs = await api.getPreferences().catch(() => null);
    listAnchors = { ...localAnchors(), ...(prefs?.listAnchors ?? {}) };

    let localFilters: Filters | null;
    try {
      localFilters = JSON.parse(
        localStorage.getItem("filters") ?? "null",
      ) as Filters | null;
    } catch {
      localFilters = null;
    }
    const savedFilters = prefs?.filters ?? localFilters;
    if (savedFilters) {
      radiusKm = savedFilters.radiusKm;
      daysFilter = savedFilters.daysFilter;
      hideViewed = savedFilters.hideViewed;
      source = savedFilters.source ?? null;
      company = savedFilters.company ?? "";
      status = savedFilters.status ?? null;
      sortMode = savedFilters.sortMode ?? "date";
    }
    if (prefs) {
      autoScrapeEnabled = prefs.autoScrapeEnabled;
      autoScrapeIntervalMinutes = prefs.autoScrapeIntervalMinutes;
    }
    filtersReady = true;

    if (!query && !location) restoreView(prefs?.lastView ?? null);

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
        jobs = res.items.map(stamp);
      } catch {
        toast.error("Impossible de charger les résultats");
      } finally {
        searching = false;
      }
    }
  });

  let sourceJobs = $derived(
    view.kind === "saved" || view.kind === "all" ? savedJobs : jobs,
  );
  let sortedJobs = $derived(
    sortMode === "score"
      ? [...sourceJobs].sort((a, b) => rankJob(b, skills) - rankJob(a, skills))
      : sourceJobs,
  );

  let groupedJobs = $derived.by(() => {
    const byKey = new Map<string, Job>();
    const order: Job[] = [];
    for (const j of sortedJobs) {
      const key = normalizeText(j.company) + "|" + normalizeText(j.title);
      const rep = byKey.get(key);
      if (!rep) {
        const copy: Job = { ...j, alternates: [] };
        byKey.set(key, copy);
        order.push(copy);
      } else if (j.source !== rep.source) {
        if (!rep.alternates!.some((a) => a.source === j.source)) {
          rep.alternates!.push({ source: j.source, url: j.url });
        }
      } else if (new Date(j.scrapedAt) > new Date(rep.scrapedAt)) {
        const updated: Job = { ...j, alternates: rep.alternates };
        byKey.set(key, updated);
        order[order.indexOf(rep)] = updated;
      }
    }
    return order;
  });

  let mappedJobs = $derived(
    groupedJobs.filter(
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
  const titleWordGroups = $derived(
    queries
      .map((q) => q.trim().split(/\s+/).filter(Boolean).map(normalizeText))
      .filter((words) => words.length > 0),
  );

  const revealBoundary = $derived.by(() => {
    if (view.kind === "saved") return activeSearch?.lastSeenAt ?? null;
    if (view.kind === "all") {
      const dates = savedSearches
        .map((s) => s.lastSeenAt)
        .filter((d): d is string => d !== null);
      return dates.length > 0
        ? dates.reduce((min, d) => (d < min ? d : min))
        : null;
    }
    return null;
  });

  let filteredJobs = $derived(
    mappedJobs.filter((j) => {
      if (hideViewed && hiddenIds.has(j.id)) return false;

      if (revealBoundary !== null) {
        const scraped = new Date(j.scrapedAt);
        if (
          !isNaN(scraped.getTime()) &&
          scraped.getTime() > new Date(revealBoundary).getTime()
        )
          return false;
      }

      if (view.kind !== "new") {
        if (status !== null && j.interactionStatus !== status) return false;
        if (
          source !== null &&
          j.source !== source &&
          !(j.alternates ?? []).some((a) => a.source === source)
        )
          return false;
        if (
          company.trim() &&
          !normalizeText(j.company).includes(normalizeText(company.trim()))
        )
          return false;
      }

      const tracked = j.interactionStatus !== undefined;

      // Radius filter — use geocoded searchCenter when available, else map center
      if (radiusKm < 500 && !tracked) {
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
      if (daysFilter !== null && !tracked) {
        const d = new Date(j.datePosted);
        if (!isNaN(d.getTime())) {
          const cutoff = Date.now() - daysFilter * 24 * 60 * 60 * 1000;
          if (d.getTime() < cutoff) return false;
        }
      }

      if (titleWordGroups.length > 0) {
        const title = normalizeText(j.title ?? "");
        if (!titleWordGroups.some((words) => words.every((w) => title.includes(w))))
          return false;
      }

      return true;
    }),
  );

  let activeJob = $state<Job | null>(null);
  let selectedJob = $state<Job | null>(null);
  const listVisible = $derived(wideScreen || mobileView === "list");
  const detailVisible = $derived(
    selectedJob !== null && (wideScreen || mobileView === "detail"),
  );
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

  let mapMoveVersion = $state(0);
  $effect(() => {
    const m = map;
    if (!m) return;
    const onMoveEnd = () => mapMoveVersion++;
    m.on("moveend", onMoveEnd);
    return () => {
      m.off("moveend", onMoveEnd);
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

  const FOCUS_PADDING_LEFT = 1016;

  function focusJob(job: Job) {
    if (!job.establishment) return;
    const currentZoom = map?.getZoom() ?? zoom;
    map?.easeTo({
      center: [job.establishment.lng, job.establishment.lat],
      zoom: Math.max(currentZoom, 13),
      padding: { left: wideScreen ? FOCUS_PADDING_LEFT : 0, top: 0, right: 0, bottom: 0 },
    });
  }

  function closeJobDetail() {
    selectedJob = null;
    if (!wideScreen) mobileView = "list";
  }

  function toggleMobileView() {
    mobileView = mobileView === "map" ? (selectedJob ? "detail" : "list") : "map";
  }

  function onPointClick(e: LayerClickInfo) {
    if (!e.features?.length) return;
    const jobId = e.features[0].properties?.id as string;
    const job = filteredJobs.find((j) => j.id === jobId);
    if (!job) return;
    selectedJob = job;
    activeJob = job;
    markViewed(job);
    focusJob(job);
  }

  async function startStream(opts: { skipGeocode?: boolean } = {}) {
    closeStream?.();
    snapshotHidden();
    const gen = ++streamGeneration;
    searching = true;
    try {
      const cached = await api.listJobs({
        query: query || undefined,
        location: location || undefined,
        limit: 200,
      });
      if (gen !== streamGeneration) return;
      jobs = cached.items.map(stamp);
    } catch {
      if (gen === streamGeneration) jobs = [];
    }
    if (gen !== streamGeneration) return;
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
      { queries, locations },
      (job) => {
        if (gen !== streamGeneration) return;
        if (jobs.some((j) => j.id === job.id)) return;
        // Each job arrives fully enriched (establishment + score already set).
        jobs = [...jobs, stamp(job)];
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

  function criteriaParams(): URLSearchParams {
    const urlParams = new URLSearchParams();
    for (const q of queries) urlParams.append("query", q);
    for (const l of locations) urlParams.append("location", l);
    return urlParams;
  }

  function search() {
    openView({ kind: "new" });
    goto(`?${criteriaParams()}`);
    startStream();
  }

  // Show "Search this area" button when the map center has moved outside the
  // current search radius. Hidden when no search yet (searchCenter === null).
  const isOutsideSearchZone = $derived.by(() => {
    void mapMoveVersion; // subscribe to map pan/zoom events
    if (searchCenter === null || !map) return false;
    const c = map.getCenter();
    return haversineKm(searchCenter[0], searchCenter[1], c.lat, c.lng) > radiusKm;
  });

  async function searchThisArea() {
    if (!map) return;
    // Snapshot map center; user may keep panning during reverse-geocode.
    const c = map.getCenter();
    const [lng, lat] = [c.lng, c.lat];
    const newSearchCenter: [number, number] = [lat, lng];
    const place = await reverseGeocode(lat, lng);
    location = place ?? `Autour de ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    searchCenter = newSearchCenter;
    goto(`?${criteriaParams()}`);
    startStream({ skipGeocode: true });
  }

  function applyInteraction(
    jobId: string,
    newStatus: InteractionStatus | undefined,
  ) {
    const at = new Date().toISOString();
    const newMap = new Map(interactionsMap);
    if (newStatus === undefined) {
      newMap.delete(jobId);
    } else {
      newMap.set(jobId, { status: newStatus, at });
    }
    interactionsMap = newMap;

    const patch = (j: Job): Job =>
      j.id === jobId
        ? {
            ...j,
            interactionStatus: newStatus,
            interactionAt: newStatus === undefined ? undefined : at,
          }
        : j;

    jobs = jobs.map(patch);
    savedJobs = savedJobs.map(patch);
    patchTabCache(patch);

    if (selectedJob?.id === jobId) {
      selectedJob = patch(selectedJob);
    }
  }

  const activeSearchId = $derived(view.kind === "saved" ? view.id : undefined);
  const activeSearchName = $derived(
    view.kind === "saved" ? activeSearch?.name : undefined,
  );

  async function bulkApplyStatus(next: InteractionStatus | null) {
    const ids = [...selectedJobIds];
    if (ids.length === 0) return;
    try {
      await api.bulkSetInteractions(ids, next, activeSearchId, activeSearchName);
      for (const id of ids) applyInteraction(id, next ?? undefined);
    } catch {
      toast.error("Impossible d'appliquer cette action groupée");
    }
  }

  async function bulkSetViewed(viewed: boolean) {
    const ids = [...selectedJobIds];
    if (ids.length === 0) return;
    try {
      await api.bulkSetViewed(ids, viewed);
      if (viewed) {
        viewedIds = new Set([...viewedIds, ...ids]);
      } else {
        const next = new Set(viewedIds);
        for (const id of ids) next.delete(id);
        viewedIds = next;
      }
      const seen = (j: Job): Job =>
        ids.includes(j.id) ? { ...j, viewed } : j;
      jobs = jobs.map(seen);
      savedJobs = savedJobs.map(seen);
      patchTabCache(seen);
    } catch {
      toast.error("Impossible d'appliquer cette action groupée");
    }
  }

  function toggleJobChecked(jobId: string) {
    const next = new Set(selectedJobIds);
    if (next.has(jobId)) next.delete(jobId);
    else next.add(jobId);
    selectedJobIds = next;
  }

  function clearJobSelection() {
    selectedJobIds = new Set();
  }
</script>

<main
  class="relative w-full h-dvh overflow-hidden"
  style="--bar: {barHeight}px"
>
  <TopBar
    bind:query
    bind:location
    {view}
    {feedNewCount}
    {openView}
    {search}
    {searching}
    jobCount={filteredJobs.length}
    loading={savedJobsLoading}
    refreshState={bannerRefreshState}
    onRequestRefresh={activeSearch && !activeSearch.archived
      ? requestRefresh
      : undefined}
    bind:skills
    bind:savedSearches
    bind:radiusKm
    bind:daysFilter
    bind:hideViewed
    bind:source
    bind:company
    bind:status
    bind:sortMode
    bind:autoScrapeEnabled
    bind:autoScrapeIntervalMinutes
    bind:barHeight
    selectedCount={selectedJobIds.size}
    onBulkStatus={bulkApplyStatus}
    onBulkViewed={bulkSetViewed}
    onClearSelection={clearJobSelection}
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
  {#if isOutsideSearchZone && (wideScreen || mobileView === "map")}
    <button
      onclick={searchThisArea}
      disabled={searching}
      class="absolute top-[calc(var(--bar)+0.5rem)] md:top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto
             flex items-center gap-2 bg-background border rounded-full
             px-4 py-2 text-sm font-medium shadow-lg
             hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Search size={14} />
      Rechercher dans cette zone
    </button>
  {/if}
  <div
    class="absolute z-10 flex flex-row gap-4 pointer-events-none
           inset-x-0 top-[var(--bar)] bottom-0
           md:inset-x-auto md:left-10 md:top-30 md:bottom-10"
  >
    {#if listVisible}
      <JobList
        newResultsCount={bannerCount}
        lastCheckedAt={bannerLastCheckedAt}
        onShowNewResults={showNewResults}
        loading={savedJobsLoading}
        jobs={filteredJobs}
        {skills}
        {activeJob}
        selectedJobId={selectedJob?.id ?? null}
        anchorKey={currentAnchorKey}
        anchorJobId={currentAnchor}
        onAnchorChange={rememberAnchor}
        {selectedJobIds}
        onToggleChecked={toggleJobChecked}
        onSelect={(job) => {
          selectedJob = job;
          activeJob = job;
          if (!wideScreen) mobileView = "detail";
          markViewed(job);
          focusJob(job);
        }}
        onHover={(job) => (activeJob = job)}
      />
    {/if}
    {#if selectedJob !== null && detailVisible}
      <JobDetail
        job={selectedJob}
        {applyInteraction}
        searchId={activeSearchId}
        searchName={activeSearchName}
        onClose={closeJobDetail}
      />
    {/if}
  </div>
  <button
    onclick={toggleMobileView}
    class="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-20
           flex items-center gap-2 bg-background border rounded-full
           px-5 py-2.5 text-sm font-medium shadow-lg"
  >
    {#if mobileView === "map"}
      {#if selectedJob}
        <Info size={16} />
        Détail
      {:else}
        <List size={16} />
        Liste
      {/if}
    {:else}
      <MapIcon size={16} />
      Carte
    {/if}
  </button>
</main>
