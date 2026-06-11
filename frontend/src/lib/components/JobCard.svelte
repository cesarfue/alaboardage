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
  onmouseenter={() => onHover?.(job.id)}
  onmouseleave={() => onHover?.(null)}
  onclick={() => onSelect?.(job.id)}
>
  <!-- TODO: visuel / logo entreprise -->
  <!-- TODO: titre (job.title) -->
  <!-- TODO: entreprise · ville (job.company / job.establishment?.city) -->
  <!-- TODO: meta (date, source) -->
  <!-- TODO: CTA « voir l'offre » (job.url) -->
</article>
