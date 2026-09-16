<script lang="ts">
  import { X } from "@lucide/svelte";

  let {
    values = $bindable<string[]>([]),
    draft = $bindable(""),
    placeholder,
    onEnterEmpty,
  }: {
    values?: string[];
    draft?: string;
    placeholder: string;
    onEnterEmpty?: () => void;
  } = $props();

  function commit() {
    const value = draft.trim();
    if (value.length === 0) {
      onEnterEmpty?.();
      return;
    }
    if (!values.includes(value)) values = [...values, value];
    draft = "";
  }
</script>

<div
  class="min-w-0 flex-1 flex flex-wrap items-center gap-1 border rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-ring"
>
  {#each values as value (value)}
    <span
      class="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap"
    >
      {value}
      <button
        onclick={() => (values = values.filter((v) => v !== value))}
        aria-label="Retirer {value}"
        class="text-muted-foreground hover:text-foreground"
      >
        <X size={11} />
      </button>
    </span>
  {/each}
  <input
    type="text"
    {placeholder}
    bind:value={draft}
    class="min-w-16 flex-1 bg-transparent py-1 text-sm outline-none"
    onkeydown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Backspace" && draft.length === 0) {
        values = values.slice(0, -1);
      }
    }}
    onblur={() => {
      if (draft.trim().length > 0) commit();
    }}
  />
</div>
