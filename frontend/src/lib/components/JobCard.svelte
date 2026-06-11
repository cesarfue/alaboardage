<script lang="ts">
  import type { Job } from "$lib/types";

  let {
    job,
    active = false,
    onHover,
    onSelect,
  }: {
    job: Job;
    active?: boolean;
    onHover?: (id: string | null) => void;
    onSelect?: (id: string) => void;
  } = $props();
</script>

<article
  class:active
  class="pointer-events-auto rounded-lg border bg-card shadow-md p-3 cursor-pointer hover:bg-muted"
  onmouseenter={() => onHover?.(job.id)}
  onmouseleave={() => onHover?.(null)}
  onclick={() => onSelect?.(job.id)}
>
  <p class="font-medium truncate">{job.title}</p>
  <p class="text-sm text-muted-foreground truncate">
    {job.company} · {job.establishment?.city ?? job.location}
  </p>
</article>
