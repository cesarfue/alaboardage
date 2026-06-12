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
  class="px-4 py-3 cursor-pointer border-b last:border-b-0 hover:bg-muted transition-colors {active ? 'bg-muted' : ''}"
  onmouseenter={() => onHover?.(job)}
  onmouseleave={() => onHover?.(null)}
  onclick={() => onSelect?.(job)}
>
  <p class="font-medium truncate">{job.title}</p>
  <p class="text-sm text-muted-foreground truncate">
    {job.company} · {job.establishment?.city ?? job.location}
  </p>
</article>
