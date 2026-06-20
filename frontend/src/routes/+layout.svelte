<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { Toaster } from "$lib/components/ui/sonner";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { setToken, getToken } from "$lib/auth";
  import { userState } from "$lib/user.svelte";
  import "../app.css";

  let { children } = $props();

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
      userState.refresh();
      history.replaceState(null, "", window.location.pathname);
    }

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
