import type { Job, ListJobsResponse, SearchOrListRequest, Skill } from "./types";

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

  streamSearch(
    params: SearchOrListRequest,
    onJob: (job: Job) => void,
    onDone: () => void,
    onError?: () => void,
    onEstablishment?: (jobId: string, establishment: Job["establishment"]) => void,
  ): () => void {
    const qs = buildQuery(params);
    const eventSource = new EventSource(`${BASE}/scraper/search${qs}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type: string;
        job?: Job;
        jobId?: string;
        establishment?: Job["establishment"];
      };
      if (data.type === "job" && data.job) onJob(data.job);
      if (data.type === "establishment" && data.jobId && data.establishment)
        onEstablishment?.(data.jobId, data.establishment);
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
};
