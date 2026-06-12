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
    onHover?: (job: Job | null) => void;
    onSelect?: (job: Job) => void;
  } = $props();
</script>

<article
  class:active
  class="pointer-events-auto rounded-lg border bg-card shadow-md p-3 cursor-pointer hover:bg-muted"
  onmouseenter={() => onHover?.(job)}
  onmouseleave={() => onHover?.(null)}
  onclick={() => onSelect?.(job)}
>
  <p class="font-medium truncate">{job.title}</p>
  <p class="text-sm text-muted-foreground truncate">
    {job.company} · {job.establishment?.city ?? job.location}
  </p>
</article>
