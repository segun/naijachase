<script lang="ts">
  import { onMount } from "svelte";
  import type { AppController } from "../state/app.svelte";
  let { app }: { app: AppController } = $props();
  onMount(() => {
    if (!app.dossierOptionsError) void app.loadDossierOptions();
  });
</script>

{#if app.dossierOptionsLoading}
  <p class="muted" role="status">Loading dossier choices...</p>
{:else if app.dossierOptionsError}
  <div class="hint warn" role="alert">
    <p>Dossier choices could not be loaded: {app.dossierOptionsError}</p>
    <button class="btn btn-secondary" type="button" onclick={() => app.loadDossierOptions()}>Retry loading choices</button>
  </div>
{/if}
