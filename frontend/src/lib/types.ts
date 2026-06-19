export interface Establishment {
  siret: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

export interface Job {
  id: string;
  externalId: string;
  source: JobSource;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  datePosted: string;
  scrapedAt: string;
  updatedAt: string;
  establishment: Establishment | null;
  score?: number;
}

export interface SearchOrListRequest {
  source?: JobSource;
  query?: string;
  company?: string;
  location?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  counts: { source: JobSource; count: number }[];
  total: number;
  durationMs: number;
}

export interface ListJobsResponse {
  items: Job[];
  total: number;
  limit: number;
  offset: number;
}

export type SkillLevel = 'primary' | 'secondary';

export interface Skill {
  name: string;
  level: SkillLevel;
}

export type JobSource =
  | "HELLOWORK"
  | "LINKEDIN"
  | "WTTJ"
  | "JTMS"
  | "JEUNESDAVENIR"
  | "INDEED"
  | "GLASSDOOR";

export const READABLE_SOURCES: Record<JobSource, string> = {
  HELLOWORK: "Hellowork",
  LINKEDIN: "LinkedIn",
  WTTJ: "WelcomeToTheJungle",
  JTMS: "JobsThatMakeSense",
  JEUNESDAVENIR: "Jeunes d'avenir",
  INDEED: "Indeed",
  GLASSDOOR: "Glassdoor",
};
