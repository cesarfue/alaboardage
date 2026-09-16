<script lang="ts">
  import { Bell, BellOff, Trash2, X } from "@lucide/svelte";

  let {
    name = $bindable(""),
    query = $bindable(""),
    location = $bindable(""),
    title,
    submitLabel,
    emailAlerts = true,
    onToggleAlerts,
    onDelete,
    onSubmit,
    onClose,
  }: {
    name?: string;
    query?: string;
    location?: string;
    title: string;
    submitLabel: string;
    emailAlerts?: boolean;
    onToggleAlerts?: () => void;
    onDelete?: () => void;
    onSubmit: (v: {
      name: string;
      queries: string[];
      locations: string[];
    }) => void;
    onClose: () => void;
  } = $props();

  const canSubmit = $derived(
    name.trim().length > 0 &&
      query.trim().length > 0 &&
      location.trim().length > 0,
  );

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      queries: [query.trim()],
      locations: [location.trim()],
    });
  }
</script>

<div
  class="pointer-events-auto w-[min(360px,calc(100vw-1.5rem))] flex flex-col gap-4 rounded-xl bg-background shadow-xl p-4"
>
  <div class="flex items-center justify-between">
    <h2 class="font-semibold text-sm">{title}</h2>
    <button
      onclick={onClose}
      aria-label="Fermer"
      class="text-muted-foreground hover:text-foreground"
    >
      <X size={16} />
    </button>
  </div>

  {#snippet field(id: string, label: string)}
    <label
      for={id}
      class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
    >
      {label}
    </label>
  {/snippet}

  <section class="flex flex-col gap-2">
    {@render field("search-name", "Nom")}
    <input
      id="search-name"
      type="text"
      bind:value={name}
      placeholder="Développeur à Paris"
      class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      onkeydown={(e) => e.key === "Enter" && submit()}
    />
  </section>

  <section class="flex flex-col gap-2">
    {@render field("search-query", "Intitulé de poste")}
    <input
      id="search-query"
      type="text"
      bind:value={query}
      placeholder="développeur"
      class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      onkeydown={(e) => e.key === "Enter" && submit()}
    />
  </section>

  <section class="flex flex-col gap-2">
    {@render field("search-location", "Ville")}
    <input
      id="search-location"
      type="text"
      bind:value={location}
      placeholder="Paris"
      class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      onkeydown={(e) => e.key === "Enter" && submit()}
    />
  </section>

  {#if onToggleAlerts}
    <button
      onclick={() => onToggleAlerts?.()}
      class="flex items-center gap-2 text-sm text-left rounded-lg px-2 py-1.5 hover:bg-muted"
    >
      {#if emailAlerts}
        <Bell size={14} class="text-primary" />
        Alertes email activées
      {:else}
        <BellOff size={14} class="text-muted-foreground" />
        Alertes email désactivées
      {/if}
    </button>
  {/if}

  <button
    onclick={submit}
    disabled={!canSubmit}
    class="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium
           hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {submitLabel}
  </button>

  {#if onDelete}
    <button
      onclick={() => onDelete?.()}
      class="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm
             text-destructive hover:bg-destructive/10 transition-colors"
    >
      <Trash2 size={14} />
      Supprimer cette recherche
    </button>
  {/if}
</div>
