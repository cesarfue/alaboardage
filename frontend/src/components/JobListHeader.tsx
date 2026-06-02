import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface Props {
  total: number;
}

export function JobListHeader({ total }: Props) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const location = searchParams.get("location") ?? "";

  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const search = useMutation({
    mutationFn: () =>
      api.refresh({
        hard: true,
        query,
        location,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Filters
      </h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-q" className="text-sm font-medium">
          Titre
        </label>
        <Input
          id="filter-q"
          placeholder="ex: développeur"
          value={query}
          onChange={(e) => updateParam("q", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-loc" className="text-sm font-medium">
          Lieu
        </label>
        <Input
          id="filter-loc"
          placeholder="ex: Lyon"
          value={location}
          onChange={(e) => updateParam("location", e.target.value)}
        />
      </div>

      <Button
        onClick={() => search.mutate()}
        disabled={search.isPending}
        className="w-full"
      >
        {search.isPending ? "Searching…" : "Search"}
      </Button>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Total jobs: {total}</span>
        {search.data && !search.isPending && (
          <span className="text-muted-foreground">
            +{search.data.total} new ({(search.data.durationMs / 1000).toFixed(1)}s)
          </span>
        )}
        {search.error && (
          <span className="text-destructive">
            {(search.error as Error).message}
          </span>
        )}
      </div>
    </div>
  );
}
