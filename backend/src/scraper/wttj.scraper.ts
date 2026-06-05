/**
 * WTTJ scraper — uses the Algolia API exposed in WTTJ's window.env.
 *
 * Background: WTTJ replaced its public search results page with an
 * auth-gated "matching" funnel in 2025. The URL /fr/jobs?query=… now
 * renders a hero/landing page, not a results list.  Company-level pages
 * (/fr/companies/{slug}/jobs) remain public but are company-scoped.
 *
 * The Algolia credentials (app ID + public client key) are still embedded
 * in the page's window.env and allow cross-company job search with a
 * Referer: https://www.welcometothejungle.com/ header.
 */

import type { ScrapeRequestDto } from './dto/scrape-request.dto';
import type { CreateJobDto } from '../jobs/dto/create-job.dto';
import { JobSource } from '../../generated/prisma/enums';

const ALGOLIA_APP_ID = 'CSEKHVMS53';
const ALGOLIA_API_KEY = '4bd8f6215d0cc52b26430765769e65a0';
const ALGOLIA_INDEX = 'wttj_jobs_production_fr';
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;
const WTTJ_BASE = 'https://www.welcometothejungle.com';

interface AlgoliaHit {
  objectID: string;
  wk_reference: string;
  name: string;
  slug: string;
  summary: string | null;
  key_missions: string[] | null;
  published_at: string | null;
  organization: {
    name: string;
    slug: string;
  };
  offices: Array<{
    city: string;
    country: string;
  }>;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  nbPages: number;
  page: number;
}

export class WTTJScraper {
  constructor(
    private readonly params: ScrapeRequestDto,
    private readonly source: JobSource,
  ) {}

  async search(): Promise<CreateJobDto[]> {
    const jobs: CreateJobDto[] = [];
    let page = this.params.offset - 1; // Algolia pages are 0-indexed
    const hitsPerPage = Math.min(this.params.limit, 50);

    while (jobs.length < this.params.limit) {
      const response = await this.queryAlgolia(page, hitsPerPage);
      if (response.hits.length === 0) break;

      for (const hit of response.hits) {
        if (jobs.length >= this.params.limit) break;
        const job = this.hitToJob(hit);
        if (job) jobs.push(job);
      }

      if (this.params.singlePage || page >= response.nbPages - 1) break;
      page++;
    }

    return jobs;
  }

  private async queryAlgolia(
    page: number,
    hitsPerPage: number,
  ): Promise<AlgoliaResponse> {
    const city = this.extractCity(this.params.location);
    const body: Record<string, unknown> = {
      query: this.params.query,
      hitsPerPage,
      page,
    };

    if (city) {
      body.facetFilters = [['offices.city:' + city]];
    }

    const response = await fetch(ALGOLIA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-algolia-api-key': ALGOLIA_API_KEY,
        'x-algolia-application-id': ALGOLIA_APP_ID,
        Referer: 'https://www.welcometothejungle.com/',
        Origin: 'https://www.welcometothejungle.com',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Algolia request failed: ${response.status} ${await response.text()}`,
      );
    }

    return response.json() as Promise<AlgoliaResponse>;
  }

  private hitToJob(hit: AlgoliaHit): CreateJobDto | null {
    const orgSlug = hit.organization?.slug;
    const jobSlug = hit.slug;
    if (!orgSlug || !jobSlug) return null;

    const url = `${WTTJ_BASE}/fr/companies/${orgSlug}/jobs/${jobSlug}`;
    const office = hit.offices?.[0];
    const location = office
      ? [office.city, office.country].filter(Boolean).join(', ')
      : '';

    const descParts: string[] = [];
    if (hit.summary) descParts.push(hit.summary);
    if (hit.key_missions?.length) {
      descParts.push(hit.key_missions.join('\n'));
    }

    return {
      externalId: hit.wk_reference || hit.objectID,
      source: this.source,
      title: hit.name,
      company: hit.organization?.name ?? '',
      location,
      description: descParts.join('\n\n'),
      url,
      datePosted: hit.published_at ? new Date(hit.published_at) : new Date(),
    };
  }

  /** Extract the first token before a comma: "Lyon, France" → "Lyon" */
  private extractCity(location: string): string {
    if (!location) return '';
    return location.split(',')[0].trim();
  }
}
