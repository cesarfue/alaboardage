<script lang="ts">
  import type { Job, Skill } from "$lib/types";
  import { matchedSkills } from "$lib/scoring";

  let {
    job,
    skills = [],
    active = false,
    selected = false,
    onHover,
    onSelect,
  }: {
    job: Job;
    skills?: Skill[];
    active?: boolean;
    selected?: boolean;
    onHover?: (job: Job | null) => void;
    onSelect?: (job: Job) => void;
  } = $props();

  let matched = $derived(matchedSkills(job, skills).slice(0, 4));
</script>

<article
  class="px-4 py-3 cursor-pointer border-b last:border-b-0 hover:bg-muted transition-colors {selected ? 'border-l-2 border-primary' : 'border-l-2 border-transparent'} {active ? 'bg-muted' : ''}"
  onmouseenter={() => onHover?.(job)}
  onmouseleave={() => onHover?.(null)}
  onclick={() => onSelect?.(job)}
>
  <p class="font-medium truncate">{job.title}</p>
  <p class="text-sm text-muted-foreground truncate">
    {job.company} · {job.establishment?.city ?? job.location}
  </p>
  {#if matched.length > 0}
    <div class="flex flex-wrap gap-1 mt-2">
      {#each matched as skill (skill.name)}
        <span
          class="px-2 py-0.5 rounded-full text-xs {skill.level === 'primary'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'}"
        >
          {skill.name}
        </span>
      {/each}
    </div>
  {/if}
</article>
