<script lang="ts">
  import { Plus, X } from "@lucide/svelte";

  let {
    name = $bindable(""),
    queries = $bindable<string[]>([]),
    locations = $bindable<string[]>([]),
    title,
    submitLabel,
    onSubmit,
    onClose,
  }: {
    name?: string;
    queries?: string[];
    locations?: string[];
    title: string;
    submitLabel: string;
    onSubmit: (v: {
      name: string;
      queries: string[];
      locations: string[];
    }) => void;
    onClose: () => void;
  } = $props();

  let queryDraft = $state("");
  let locationDraft = $state("");

  const canSubmit = $derived(
    name.trim().length > 0 && queries.length > 0 && locations.length > 0,
  );

  function addTo(list: "queries" | "locations", raw: string) {
    const value = raw.trim();
    if (value.length === 0) return;
    if (list === "queries") {
      if (!queries.includes(value)) queries = [...queries, value];
      queryDraft = "";
    } else {
      if (!locations.includes(value)) locations = [...locations, value];
      locationDraft = "";
    }
  }

  function removeFrom(list: "queries" | "locations", value: string) {
    if (list === "queries") queries = queries.filter((v) => v !== value);
    else locations = locations.filter((v) => v !== value);
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

  <section class="flex flex-col gap-2">
    <label
      for="search-name"
      class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
    >
      Nom
    </label>
    <input
      id="search-name"
      type="text"
      bind:value={name}
      placeholder="Développeur en Île-de-France"
      class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    />
  </section>

  {#snippet chips(
    list: "queries" | "locations",
    values: string[],
    label: string,
    placeholder: string,
    draft: string,
    setDraft: (v: string) => void,
  )}
    <section class="flex flex-col gap-2">
      <p
        class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
      >
        {label}
      </p>
      {#if values.length > 0}
        <div class="flex flex-wrap gap-1.5">
          {#each values as value (value)}
            <span
              class="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {value}
              <button
                onclick={() => removeFrom(list, value)}
                aria-label="Retirer {value}"
                class="text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            </span>
          {/each}
        </div>
      {/if}
      <div class="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          oninput={(e) => setDraft(e.currentTarget.value)}
          {placeholder}
          class="min-w-0 flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          onkeydown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addTo(list, e.currentTarget.value);
          }}
        />
        <button
          onclick={() => addTo(list, draft)}
          aria-label="Ajouter"
          class="shrink-0 border rounded-lg px-2.5 py-2 hover:bg-muted"
        >
          <Plus size={16} />
        </button>
      </div>
    </section>
  {/snippet}

  {@render chips(
    "queries",
    queries,
    "Intitulés de poste",
    "développeur",
    queryDraft,
    (v) => (queryDraft = v),
  )}
  {@render chips(
    "locations",
    locations,
    "Villes",
    "Paris",
    locationDraft,
    (v) => (locationDraft = v),
  )}

  <button
    onclick={() =>
      onSubmit({ name: name.trim(), queries, locations })}
    disabled={!canSubmit}
    class="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium
           hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {submitLabel}
  </button>
</div>
