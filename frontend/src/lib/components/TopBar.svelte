<script lang="ts">
  import { Funnel, User, LogOut } from "@lucide/svelte";
  import FiltersPanel from "$lib/components/FiltersPanel.svelte";
  import ProfilePanel from "$lib/components/ProfilePanel.svelte";
  import type { Skill } from "$lib/types";
  import { getUser, clearToken } from "$lib/auth";

  let {
    query = $bindable(),
    location = $bindable(),
    search,
    searching,
    skills = $bindable(),
    radiusKm = $bindable(),
    daysFilter = $bindable(),
  }: {
    query: string;
    location: string;
    search: () => void;
    searching: boolean;
    skills: Skill[];
    radiusKm: number;
    daysFilter: number | null;
  } = $props();

  let showingFilters = $state(false);
  let showingProfile = $state(false);

  const user = $derived(getUser());

  function closeAll() {
    showingFilters = false;
    showingProfile = false;
  }

  function toggleFilters() {
    showingFilters = !showingFilters;
    if (showingFilters) showingProfile = false;
  }

  function toggleProfile() {
    showingProfile = !showingProfile;
    if (showingProfile) showingFilters = false;
  }

  function logout() {
    clearToken();
    window.location.href = "/";
  }
</script>

{#if showingFilters || showingProfile}
  <div
    class="fixed inset-0 z-40"
    role="presentation"
    onclick={closeAll}
    onkeydown={(e) => e.key === "Escape" && closeAll()}
  ></div>
{/if}

<div
  class="absolute w-full z-20 pointer-events-auto
         flex flex-row items-center gap-2 p-3 bg-background"
>
  <input
    type="text"
    placeholder="Poste"
    bind:value={query}
    class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
  />
  <input
    type="text"
    placeholder="Lieu"
    bind:value={location}
    class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    onkeydown={(e) => e.key === "Enter" && search()}
  />
  <div class="relative">
    <button
      onclick={toggleFilters}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingFilters ? 'bg-muted' : ''}"
    >
      <Funnel size={16} />
    </button>
    {#if showingFilters}
      <div class="absolute top-full mt-1 z-50 left-0">
        <FiltersPanel bind:radiusKm bind:daysFilter onClose={() => (showingFilters = false)} />
      </div>
    {/if}
  </div>
  <button
    onclick={search}
    disabled={searching}
    class="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
  >
    {searching ? "Recherche…" : "Rechercher"}
  </button>
  <div class="relative">
    <button
      onclick={toggleProfile}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted {showingProfile ? 'bg-muted' : ''}"
    >
      <User size={16} />
    </button>
    {#if showingProfile}
      <div class="absolute top-full mt-1 z-50 right-0">
        <ProfilePanel bind:skills onClose={() => (showingProfile = false)} />
      </div>
    {/if}
  </div>

  {#if user}
    <span class="text-sm text-muted-foreground hidden sm:block">{user.name}</span>
    <button
      onclick={logout}
      class="border rounded-lg px-3 py-2 transition-colors hover:bg-muted"
      title="Déconnexion"
    >
      <LogOut size={16} />
    </button>
  {:else}
    <a
      href="http://localhost:3000/auth/google"
      class="border rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted whitespace-nowrap"
    >
      Se connecter
    </a>
  {/if}
</div>
