import type { SavedSearch } from '../../generated/prisma/client';

export interface SearchCriteria {
  queries: string[];
  locations: string[];
}

export function criteriaOf(search: SavedSearch): SearchCriteria {
  return {
    queries: search.queries.length > 0 ? search.queries : [search.query],
    locations:
      search.locations.length > 0 ? search.locations : [search.location],
  };
}
