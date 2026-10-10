<script lang="ts">
  import { onMount } from "svelte";
  import { AppController } from "./state/app.svelte";
  import { isCaseScreen } from "./domain/model.ts";
  import AuthPanel from "./screens/entry/AuthPanel.svelte";
  import Brand from "./ui/Brand.svelte";
  import ContentGate from "./screens/admin/ContentGate.svelte";
  import Landing from "./screens/entry/Landing.svelte";
  import Results from "./screens/case/Results.svelte";
  import Shell from "./ui/Shell.svelte";

  // Secondary screens are separate chunks: nobody needs them on the sign-in path, so they load on first visit.
  const lazy = {
    avatar: () => import("./avatar/AvatarPicker.svelte"),
    archive: () => import("./scenes/archive/ArchiveRoom.svelte"),
    groups: () => import("./screens/social/Groups.svelte"),
    helpers: () => import("./screens/social/Helpers.svelte"),
    room: () => import("./scenes/office/Room.svelte"),
    garage: () => import("./scenes/garage/GarageRoom.svelte"),
    witness: () => import("./scenes/witness/WitnessScene.svelte"),
    journey: () => import("./scenes/journey/JourneyScene.svelte"),
    settings: () => import("./screens/account/Settings.svelte"),
    tokens: () => import("./screens/account/Tokens.svelte"),
    panel: () => import("./scenes/panel/PanelScene.svelte"),
    weekly: () => import("./screens/social/Weekly.svelte")
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
      {:else if app.screen === "tokens" && app.signedIn}{#await lazy.tokens() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "content" && app.signedIn}<ContentGate {app} />
      {:else if app.screen === "groups" && app.signedIn}{#await lazy.groups() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "weekly" && app.signedIn}{#await lazy.weekly() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "helpers" && app.signedIn}{#await lazy.helpers() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "archive" && app.signedIn}{#await lazy.archive() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "cases" && !app.signedIn}<AuthPanel {app} />
      {:else if app.screen === "cases" || (app.game && isCaseScreen(app.screen))}{@render room()}
      {:else if app.game && app.screen === "garage"}{#await lazy.garage() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.game && app.screen === "witness" && app.witnessVisit}{#await lazy.witness() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.game && app.screen === "journey" && app.journey}{#await lazy.journey() then { default: Screen }}<Screen {app} />{/await}
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
    {#if app.signedIn && app.panel}{#await lazy.panel() then { default: Screen }}<Screen {app} />{/await}{/if}
  </Shell>
{/if}
