<script lang="ts">
  import { onMount } from "svelte";
  import { AppController } from "./lib/app.svelte";
  import Archive from "./components/Archive.svelte";
  import AuthPanel from "./components/AuthPanel.svelte";
  import Brand from "./components/Brand.svelte";
  import CaseDesk from "./components/CaseDesk.svelte";
  import Dossier from "./components/Dossier.svelte";
  import Investigate from "./components/Investigate.svelte";
  import Landing from "./components/Landing.svelte";
  import Notebook from "./components/Notebook.svelte";
  import Results from "./components/Results.svelte";
  import Settings from "./components/Settings.svelte";
  import Shell from "./components/Shell.svelte";
  import Travel from "./components/Travel.svelte";
  import Warrant from "./components/Warrant.svelte";

  const app = new AppController();
  // Menu music belongs to the screens before the game: home, register, login and recovery.
  $effect(() => { app.music.setActive(!app.booting && !app.signedIn && (app.screen === "welcome" || app.screen === "cases")); });
  onMount(() => app.boot());
</script>

<svelte:window
  ononline={() => app.toast("Connection restored.", "success")}
  onoffline={() => app.toast("You are offline. Your case is safe; commands will work again once you reconnect.")}
/>

{#if app.booting}
  <div class="boot" role="status"><Brand /><p>Opening the case files…</p></div>
{:else}
  <Shell {app}>
    <svelte:boundary>
      {#if app.screen === "welcome"}<Landing {app} />
      {:else if app.screen === "settings"}<Settings {app} />
      {:else if app.screen === "archive" && app.signedIn}<Archive {app} />
      {:else if app.screen === "cases" && !app.signedIn}<AuthPanel {app} />
      {:else if app.screen === "cases"}<CaseDesk {app} />
      {:else if app.game && app.screen === "investigate"}<Investigate {app} />
      {:else if app.game && app.screen === "notebook"}<Notebook {app} />
      {:else if app.game && app.screen === "dossier"}<Dossier {app} />
      {:else if app.game && app.screen === "travel"}<Travel {app} />
      {:else if app.game && app.screen === "warrant"}<Warrant {app} />
      {:else if app.game && app.screen === "results"}<Results {app} />
      {:else}<CaseDesk {app} />{/if}

      {#snippet failed(error, reset)}
        <div class="crash card" role="alert">
          <h1>Something went wrong</h1>
          <p class="muted">The screen failed to draw, but your case is saved on the server.</p>
          <p class="mono muted">{error instanceof Error ? error.message : String(error)}</p>
          <button class="btn btn-primary" type="button" onclick={() => { reset(); app.go(app.signedIn ? "cases" : "welcome"); }}>Back to safety</button>
        </div>
      {/snippet}
    </svelte:boundary>
  </Shell>
{/if}
