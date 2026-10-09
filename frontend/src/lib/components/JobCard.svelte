<script lang="ts">
  import type { InteractionStatus, Job, Skill } from "$lib/types";
  import { READABLE_SOURCES } from "$lib/types";
  import { matchedSkills } from "$lib/scoring";

  const STATUS_LABEL: Record<InteractionStatus, string> = {
    SAVED: "Favori",
    APPLIED: "Postulé",
    REJECTED: "Refusé",
  };

  const STATUS_COLOR: Record<InteractionStatus, string> = {
    SAVED: "text-foreground",
    APPLIED: "text-primary",
    REJECTED: "text-destructive",
  };

  let {
    job,
    skills = [],
    active = false,
    selected = false,
    checked = false,
    onHover,
    onSelect,
    onToggleChecked,
  }: {
    job: Job;
    skills?: Skill[];
    active?: boolean;
    selected?: boolean;
    checked?: boolean;
    onHover?: (job: Job | null) => void;
    onSelect?: (job: Job) => void;
    onToggleChecked?: (jobId: string) => void;
  } = $props();

  let matched = $derived(matchedSkills(job, skills).slice(0, 4));
  let dimmed = $derived(!!job.viewed || !!job.interactionStatus);
  let dateFormatted = $derived(
    new Date(job.datePosted).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    }),
  );
</script>

<article
  data-job-id={job.id}
  class="px-4 py-3 cursor-pointer border-b last:border-b-0 transition-colors {selected
    ? 'ring-2 ring-inset ring-primary'
    : ''} {dimmed
    ? active
      ? 'bg-foreground/12'
      : 'bg-foreground/7 hover:bg-foreground/12'
    : active
      ? 'bg-muted'
      : 'hover:bg-muted'}"
  onmouseenter={() => onHover?.(job)}
  onmouseleave={() => onHover?.(null)}
  onclick={() => onSelect?.(job)}
>
  <div class="flex items-start gap-2">
    <div class="min-w-0 flex-1">
      <p class="font-medium truncate {dimmed ? 'font-normal text-foreground/70' : ''}">
        {job.title}
      </p>
      <p class="text-sm text-muted-foreground truncate">
        {job.company} · {job.establishment?.city ?? job.location}
      </p>
    </div>
    {#if onToggleChecked}
      <input
        type="checkbox"
        checked={checked}
        onclick={(e) => {
          e.stopPropagation();
          onToggleChecked?.(job.id);
        }}
        aria-label="Sélectionner cette offre"
        class="mt-1 shrink-0 accent-primary"
      />
    {/if}
  </div>
  <p class="text-xs text-muted-foreground truncate mt-0.5">
    {[job.source, ...(job.alternates ?? []).map((a) => a.source)]
      .map((s) => READABLE_SOURCES[s])
      .join(" · ")}
    · {dateFormatted}
  </p>
  {#if job.interactionStatus}
    <p class="text-xs mt-1">
      <span class="font-medium {STATUS_COLOR[job.interactionStatus]}">
        {STATUS_LABEL[job.interactionStatus]}
      </span>
      {#if job.interactionAt}
        <span class="text-muted-foreground">
          · {new Date(job.interactionAt).toLocaleDateString("fr-FR")}
        </span>
      {/if}
    </p>
  {/if}
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
