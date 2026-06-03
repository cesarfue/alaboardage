import type {
  Job,
  ListJobsResponse,
  SearchOrListRequest,
  SearchResponse,
} from "./types";

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

  search(params: SearchOrListRequest = {}): Promise<SearchResponse> {
    return request<SearchResponse>(`/scraper/search${buildQuery(params)}`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  getJob(id: string): Promise<Job> {
    return request<Job>(`/jobs/${encodeURIComponent(id)}`);
  },
};
