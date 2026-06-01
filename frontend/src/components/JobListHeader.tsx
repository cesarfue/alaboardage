import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function JobListHeader() {
  const queryClient = useQueryClient();

  const refresh = useMutation({
    mutationFn: () => api.refresh({ hard: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-semibold">Jobs</h1>
      <div className="flex items-center gap-3">
        {refresh.data && !refresh.isPending && (
          <span className="text-sm text-muted-foreground">
            +{refresh.data.total} jobs ({(refresh.data.durationMs / 1000).toFixed(1)}s)
          </span>
        )}
        {refresh.error && (
          <span className="text-sm text-destructive">
            {(refresh.error as Error).message}
          </span>
        )}
        <Button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
