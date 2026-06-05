<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { page } from "$app/state";
  import { api, ApiError } from "$lib/api";
  import type { Job } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  let query = $state(page.url.searchParams.get("query") ?? "");
  let location = $state(page.url.searchParams.get("location") ?? "");
  let jobs = $state<Job[]>([]);

  $effect(() => {
    const q = page.url.searchParams.get("query") ?? "";
    const loc = page.url.searchParams.get("location") ?? "";
    console.log("calling effect");
    api
      .listJobs({ query: q || undefined, location: loc || undefined })
      .then((res) => {
        jobs = res.items;
      });
  });

  async function search() {
    api
      .listJobs({ query: query || undefined, location: location || undefined })
      .then((res) => (jobs = res.items));
    try {
      await api.search({
        query: query || undefined,
        location: location || undefined,
      });
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (location) params.set("location", location);
      goto(`?${params}`);
    } catch (e) {
      toast.error(
        e instanceof ApiError ? `Erreur ${e.status}` : "Erreur inattendue",
      );
    }
  }
</script>

<div class="flex h-screen">
  <aside class="w-64 shrink-0 p-4 border">
    <input type="text" placeholder="Job type" bind:value={query} />
    <input type="text" placeholder="Location" bind:value={location} />
    <button onclick={search}> Rechercher </button>
  </aside>
  <main class="flex-1 min-w-0 overflow-auto p-4">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Title</Table.Head>
          <Table.Head>Company</Table.Head>
          <Table.Head>Location</Table.Head>
          <Table.Head>Source</Table.Head>
          <Table.Head>Date Posted</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each jobs as job (job.id)}
          <Table.Row>
            <Table.Cell class="font-medium">{job.title}</Table.Cell>
            <Table.Cell>{job.company}</Table.Cell>
            <Table.Cell>{job.location}</Table.Cell>
            <Table.Cell>{job.source}</Table.Cell>
            <Table.Cell>{job.datePosted}</Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </main>
</div>
