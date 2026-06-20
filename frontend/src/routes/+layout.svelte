<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { Toaster } from "$lib/components/ui/sonner";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getToken } from "$lib/auth";
  import "../app.css";

  let { children } = $props();

  onMount(() => {
    // Auth guard — fires after page onMount has captured and stored the token
    if (!getToken() && window.location.pathname !== "/login") {
      goto("/login");
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
<Toaster />
