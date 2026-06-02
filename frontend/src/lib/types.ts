export type JobSource = 'HELLOWORK' | 'LINKEDIN' | 'WTTJ'

export interface Job {
	id: string
	externalId: string
	source: JobSource
	title: string
	company: string
	location: string
	description: string
	url: string
	datePosted: string
	scrapedAt: string
	updatedAt: string
}

export interface JobListResponse {
	items: Job[]
	total: number
	limit: number
	offset: number
}

export interface ListJobsParams {
	source?: JobSource
	q?: string
	company?: string
	location?: string
	limit?: number
	offset?: number
}

export interface RefreshRequest {
	query?: string
	location?: string
	hard?: boolean
	limit?: number
}

export interface RefreshResponse {
	deleted: number
	counts: { source: JobSource; count: number }[]
	total: number
	durationMs: number
}
