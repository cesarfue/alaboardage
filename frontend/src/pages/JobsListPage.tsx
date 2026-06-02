import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { JobsTable } from "../components/JobsTable";
import { JobListHeader } from "@/components/JobListHeader";

export function JobsListPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const location = searchParams.get("location") ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", { q, location }],
    queryFn: () =>
      api.listJobs({
        limit: 50,
        q: q || undefined,
        location: location || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex gap-6">
      <aside className="w-64 shrink-0">
        <JobListHeader total={data?.total ?? 0} />
      </aside>
      <section className="flex-1 min-w-0">
        {isLoading ? (
          <p>Loading…</p>
        ) : error ? (
          <p>Error: {(error as Error).message}</p>
        ) : (
          <JobsTable jobs={data?.items ?? []} />
        )}
      </section>
    </div>
  );
}
