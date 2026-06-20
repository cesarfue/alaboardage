<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getToken, setToken } from "$lib/auth";
  import { userState } from "$lib/user.svelte";
  import { api, ApiError } from "$lib/api";

  onMount(() => {
    if (getToken()) goto("/");
  });

  let mode: "login" | "register" = $state("login");
  let email = $state("");
  let name = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function submit() {
    error = "";
    loading = true;
    try {
      let result: { access_token: string };
      if (mode === "register") {
        result = await api.register(email, name, password);
      } else {
        result = await api.loginWithPassword(email, password);
      }
      setToken(result.access_token);
      userState.refresh();
      await goto("/");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          error = "Email ou mot de passe incorrect.";
        } else if (e.status === 409) {
          error = "Cet email est déjà utilisé.";
        } else if (e.status === 400) {
          const detail = e.detail as { message?: string | string[] };
          const msg = detail?.message;
          error = Array.isArray(msg) ? msg[0] : (msg ?? "Données invalides.");
        } else {
          error = "Une erreur est survenue. Réessayez.";
        }
      } else {
        error = "Une erreur est survenue. Réessayez.";
      }
    } finally {
      loading = false;
    }
  }
</script>

<main class="flex h-screen w-full items-center justify-center bg-background">
  <div class="flex flex-col items-center gap-6 w-full max-w-sm px-4">
    <div class="flex flex-col gap-1 text-center">
      <h1 class="text-2xl font-semibold tracking-tight">Alaboardage</h1>
      <p class="text-sm text-muted-foreground">Agrégateur d'offres d'emploi</p>
    </div>

    <!-- Email / password form -->
    <form
      class="flex flex-col gap-3 w-full"
      onsubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <div class="flex rounded-lg border overflow-hidden text-sm">
        <button
          type="button"
          onclick={() => { mode = "login"; error = ""; }}
          class="flex-1 py-2 transition-colors {mode === 'login' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
        >
          Connexion
        </button>
        <button
          type="button"
          onclick={() => { mode = "register"; error = ""; }}
          class="flex-1 py-2 transition-colors {mode === 'register' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
        >
          Inscription
        </button>
      </div>

      <input
        type="email"
        placeholder="Email"
        bind:value={email}
        required
        class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-full"
      />

      {#if mode === "register"}
        <input
          type="text"
          placeholder="Nom"
          bind:value={name}
          required
          class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-full"
        />
      {/if}

      <input
        type="password"
        placeholder="Mot de passe"
        bind:value={password}
        required
        minlength={8}
        class="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring w-full"
      />

      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {loading ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer un compte"}
      </button>
    </form>

    <div class="flex items-center gap-3 w-full">
      <div class="flex-1 border-t"></div>
      <span class="text-xs text-muted-foreground">ou</span>
      <div class="flex-1 border-t"></div>
    </div>

    <a
      href="/api/auth/google"
      class="inline-flex items-center gap-3 rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted w-full justify-center"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Se connecter avec Google
    </a>
  </div>
</main>
