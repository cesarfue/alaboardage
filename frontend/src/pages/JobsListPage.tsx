import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { JobsTable } from "../components/JobsTable";
import { JobListHeader } from "@/components/JobListHeader";

export function JobsListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.listJobs({ limit: 50 }),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Error: {(error as Error).message}</p>;

  return (
    <div>
      <JobListHeader />
      <JobsTable jobs={data?.items ?? []} />
    </div>
  );
}
