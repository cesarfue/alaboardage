import type {
  Job,
  JobListResponse,
  ListJobsParams,
  RefreshRequest,
  RefreshResponse,
  ScrapeRequest,
  ScrapeResponse,
} from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      detail = await res.text()
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(`HTTP ${status}`)
  }
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === null) continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  listJobs(params: ListJobsParams = {}): Promise<JobListResponse> {
    return request<JobListResponse>(`/jobs${buildQuery(params)}`)
  },

  getJob(id: string): Promise<Job> {
    return request<Job>(`/jobs/${encodeURIComponent(id)}`)
  },

  scrape(body: ScrapeRequest): Promise<ScrapeResponse> {
    return request<ScrapeResponse>('/scrape', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  refresh(body: RefreshRequest = {}): Promise<RefreshResponse> {
    return request<RefreshResponse>('/scrape/refresh', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
}
