<script lang="ts">
  import { onMount } from "svelte";
  import { AppController } from "./lib/app.svelte";
  import AuthPanel from "./components/AuthPanel.svelte";
  import Brand from "./components/Brand.svelte";
  import ContentGate from "./components/ContentGate.svelte";
  import Dossier from "./components/Dossier.svelte";
  import Investigate from "./components/Investigate.svelte";
  import Landing from "./components/Landing.svelte";
  import Notebook from "./components/Notebook.svelte";
  import Results from "./components/Results.svelte";
  import Shell from "./components/Shell.svelte";
  import Travel from "./components/Travel.svelte";
  import Warrant from "./components/Warrant.svelte";

  // Secondary screens are separate chunks: nobody needs them on the sign-in path, so they load on first visit.
  const lazy = {
    avatar: () => import("./components/AvatarPicker.svelte"),
    archive: () => import("./components/ArchiveRoom.svelte"),
    groups: () => import("./components/Groups.svelte"),
    helpers: () => import("./components/Helpers.svelte"),
    room: () => import("./components/Room.svelte"),
    garage: () => import("./components/GarageRoom.svelte"),
    settings: () => import("./components/Settings.svelte"),
    weekly: () => import("./components/Weekly.svelte")
  } as const;

  const app = new AppController();
  // The music starts on the home screen and carries on through sign-in and the game.
  $effect(() => { app.music.setActive(!app.booting); });
  onMount(() => app.boot());
</script>

<svelte:window
  onhashchange={() => app.syncRoute()}
  ononline={() => app.toast("Connection restored.", "success")}
  onoffline={() => app.toast("You are offline. Your case is safe; commands will work again once you reconnect.")}
/>

{#snippet room()}
  {#await lazy.room()}
    <p class="boot" role="status">Opening the office…</p>
  {:then { default: Screen }}<Screen {app} />
  {:catch}
    <div class="crash card" role="alert">
      <h1>The office did not load</h1>
      <p class="muted">The page may have been updated while it was open. Reload to continue; your case is saved.</p>
      <button class="btn btn-primary" type="button" onclick={() => location.reload()}>Reload</button>
    </div>
  {/await}
{/snippet}

{#if app.booting}
  <div class="boot" role="status"><Brand /><p>Opening the case files…</p></div>
{:else}
  <Shell {app}>
    <svelte:boundary>
      {#if app.signedIn && app.needsAvatar}{#await lazy.avatar() then { default: Screen }}<div class="page"><Screen {app} first /></div>{/await}
      {:else if app.screen === "welcome"}<Landing {app} />
      {:else if app.screen === "settings"}{#await lazy.settings() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "content" && app.signedIn}<ContentGate {app} />
      {:else if app.screen === "groups" && app.signedIn}{#await lazy.groups() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "weekly" && app.signedIn}{#await lazy.weekly() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "helpers" && app.signedIn}{#await lazy.helpers() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "archive" && app.signedIn}{#await lazy.archive() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "cases" && !app.signedIn}<AuthPanel {app} />
      {:else if app.screen === "cases"}{@render room()}
      {:else if app.game && app.screen === "garage"}{#await lazy.garage() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.game && app.screen === "investigate"}<Investigate {app} />
      {:else if app.game && app.screen === "notebook"}<Notebook {app} />
      {:else if app.game && app.screen === "dossier"}<Dossier {app} />
      {:else if app.game && app.screen === "travel"}<Travel {app} />
      {:else if app.game && app.screen === "warrant"}<Warrant {app} />
      {:else if app.game && app.screen === "results"}<Results {app} />
      {:else}{@render room()}{/if}

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
