import type { Filters, InteractionStatus, Job, ListJobsResponse, Preferences, RefreshState, SavedSearch, SearchOrListRequest, Skill, View } from "./types";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }
  // 204 No Content (and any other empty body) — return undefined instead of
  // choking on `res.json()`. Callers typing this as `Promise<void>` get what
  // they expect; callers awaiting real JSON parse it normally.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: SearchOrListRequest): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, unknown][]) {
    if (value === undefined || value === "" || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  listJobs(params: SearchOrListRequest = {}): Promise<ListJobsResponse> {
    return request<ListJobsResponse>(`/jobs${buildQuery(params)}`);
  },

  streamSearch(
    params: { queries: string[]; locations: string[] },
    onJob: (job: Job) => void,
    onDone: () => void,
    onError?: () => void,
  ): () => void {
    const search = new URLSearchParams();
    for (const q of params.queries) search.append("query", q);
    for (const l of params.locations) search.append("location", l);
    const eventSource = new EventSource(`${BASE}/scraper/search?${search}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type: string;
        job?: Job;
      };
      // Each `job` event now carries the resolved establishment and score;
      // there is no separate `establishment` event.
      if (data.type === "job" && data.job) onJob(data.job);
      if (data.type === "done") {
        eventSource.close();
        onDone();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      onError?.();
      onDone();
    };

    return () => eventSource.close();
  },

  getJob(id: string): Promise<Job> {
    return request<Job>(`/jobs/${encodeURIComponent(id)}`);
  },

  async getSkills(): Promise<Skill[]> {
    const raw = await request<{ name: string; level: string }[]>("/skills");
    return raw.map((s) => ({
      name: s.name,
      level: s.level === "PRIMARY" ? "primary" : "secondary",
    }));
  },

  setSkills(skills: Skill[]): Promise<void> {
    return request<void>("/skills", {
      method: "PUT",
      body: JSON.stringify({
        skills: skills.map((s) => ({
          name: s.name,
          level: s.level === "primary" ? "PRIMARY" : "SECONDARY",
        })),
      }),
    });
  },

  getInteractions(): Promise<
    { jobId: string; status: InteractionStatus; updatedAt: string }[]
  > {
    return request<
      { jobId: string; status: InteractionStatus; updatedAt: string }[]
    >("/interactions");
  },

  setInteraction(jobId: string, status: InteractionStatus): Promise<void> {
    return request<void>(`/jobs/${encodeURIComponent(jobId)}/interaction`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },

  deleteInteraction(jobId: string): Promise<void> {
    return request<void>(`/jobs/${encodeURIComponent(jobId)}/interaction`, {
      method: "DELETE",
    });
  },

  getViews(): Promise<string[]> {
    return request<string[]>("/views");
  },

  markViewed(jobId: string): Promise<void> {
    return request<void>(`/jobs/${encodeURIComponent(jobId)}/view`, {
      method: "POST",
    });
  },

  getSavedSearches(daysFilter?: number | null): Promise<SavedSearch[]> {
    const qs = daysFilter != null ? `?daysFilter=${daysFilter}` : "";
    return request<SavedSearch[]>(`/searches${qs}`);
  },

  saveSearch(
    name: string,
    queries: string[],
    locations: string[],
  ): Promise<SavedSearch> {
    return request<SavedSearch>("/searches", {
      method: "POST",
      body: JSON.stringify({ name, queries, locations }),
    });
  },

  listSavedSearchJobs(
    id: string,
    limit = 200,
    daysFilter?: number | null,
  ): Promise<ListJobsResponse> {
    const qs = daysFilter != null ? `&daysFilter=${daysFilter}` : "";
    return request<ListJobsResponse>(
      `/searches/${encodeURIComponent(id)}/jobs?limit=${limit}${qs}`,
    );
  },

  deleteSavedSearch(id: string): Promise<void> {
    return request<void>(`/searches/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  updateSavedSearch(
    id: string,
    patch: {
      name?: string;
      queries?: string[];
      locations?: string[];
    },
  ): Promise<SavedSearch> {
    return request<SavedSearch>(`/searches/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  reorderSearches(ids: string[]): Promise<void> {
    return request<void>("/searches/order", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  },

  getPreferences(): Promise<Preferences> {
    return request<Preferences>("/preferences");
  },

  updatePreferences(patch: {
    lastView?: View;
    anchor?: { tab: string; jobId: string | null };
    filters?: Filters;
    autoScrapeEnabled?: boolean;
    autoScrapeIntervalMinutes?: number;
  }): Promise<Preferences> {
    return request<Preferences>("/preferences", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  getFeed(
    limit = 200,
    daysFilter?: number | null,
  ): Promise<ListJobsResponse & { newCount: number }> {
    const qs = daysFilter != null ? `&daysFilter=${daysFilter}` : "";
    return request<ListJobsResponse & { newCount: number }>(
      `/feed?limit=${limit}${qs}`,
    );
  },

  markFeedSeen(): Promise<void> {
    return request<void>("/feed/seen", { method: "POST" });
  },

  requestFeedRefresh(): Promise<{ states: RefreshState[] }> {
    return request<{ states: RefreshState[] }>("/feed/refresh", {
      method: "POST",
    });
  },

  requestSearchRefresh(id: string): Promise<{ state: RefreshState }> {
    return request<{ state: RefreshState }>(
      `/searches/${encodeURIComponent(id)}/refresh`,
      { method: "POST" },
    );
  },

  markSavedSearchSeen(id: string): Promise<SavedSearch> {
    return request<SavedSearch>(
      `/searches/${encodeURIComponent(id)}/seen`,
      { method: "POST" },
    );
  },
};
