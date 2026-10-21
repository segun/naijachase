<script lang="ts">
  import { onMount } from "svelte";
  import { AppController } from "./state/app.svelte";
  import { isCaseScreen } from "./domain/model.ts";
  import Brand from "./ui/Brand.svelte";
  import Landing from "./screens/entry/Landing.svelte";
  import Shell from "./ui/Shell.svelte";
  import { reportBrowserError } from "./telemetry.ts";

  // Secondary screens are separate chunks: nobody needs them on the sign-in path, so they load on first visit.
  const lazy = {
    auth: () => import("./screens/entry/AuthPanel.svelte"),
    avatar: () => import("./avatar/AvatarPicker.svelte"),
    archive: () => import("./scenes/archive/ArchiveRoom.svelte"),
    groups: () => import("./screens/social/Groups.svelte"),
    helpers: () => import("./screens/social/Helpers.svelte"),
    room: () => import("./scenes/office/Room.svelte"),
    garage: () => import("./scenes/garage/GarageRoom.svelte"),
    witness: () => import("./scenes/witness/WitnessScene.svelte"),
    journey: () => import("./scenes/journey/JourneyScene.svelte"),
    raid: () => import("./scenes/chase/RaidScene.svelte"),
    settings: () => import("./screens/account/Settings.svelte"),
    tokens: () => import("./screens/account/Tokens.svelte"),
    panel: () => import("./scenes/panel/PanelScene.svelte"),
    weekly: () => import("./screens/social/Weekly.svelte"),
    content: () => import("./screens/admin/ContentGate.svelte"),
    results: () => import("./screens/case/Results.svelte"),
    achievementShare: () => import("./ui/AchievementShareDialog.svelte"),
    detail: () => import("./ui/SceneOptions.svelte")
  } as const;

  const app = new AppController();
  const sceneOptions = $derived(app.signedIn && !app.needsAvatar && Boolean(app.panel || isCaseScreen(app.screen) || ["garage", "witness", "journey", "raid", "cases", "archive"].includes(app.screen)));
  function reportRenderError(error: unknown) {
    console.error("Screen render failed", error);
    reportBrowserError(error, "svelte.boundary");
  }
  // The music starts on the home screen and carries on through sign-in and the game.
  $effect(() => { app.music.setActive(!app.booting); });
  // Weekly play has its own colour scheme so the player always knows which case they are on.
  $effect(() => { document.documentElement.dataset.mode = app.isWeekly ? "weekly" : "ordinary"; });
  onMount(() => app.boot());
</script>

<svelte:window
  onhashchange={() => app.syncRoute()}
  ononline={() => app.toast("Connection restored.", "success")}
  onoffline={() => app.toast("You’re offline. Reconnect to continue.")}
/>

{#snippet room()}
  {#await lazy.room()}
    <p class="boot" role="status">Opening the office…</p>
  {:then { default: Screen }}<Screen {app} />
  {:catch}
    <div class="crash card" role="alert">
      <h1>The office did not load</h1>
      <p class="muted">Reload to continue. Your case is saved.</p>
      <button class="btn btn-primary" type="button" onclick={() => location.reload()}>Reload</button>
    </div>
  {/await}
{/snippet}

{#if app.booting}
  <div class="boot" role="status"><Brand /><p>Opening the case files…</p></div>
{:else}
  <Shell {app} {sceneOptions}>
    <svelte:boundary onerror={reportRenderError}>
      {#if app.signedIn && app.needsAvatar}{#await lazy.avatar() then { default: Screen }}<div class="page"><Screen {app} first /></div>{/await}
      {:else if app.screen === "welcome"}<Landing {app} />
      {:else if app.screen === "settings"}{#await lazy.settings() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "tokens" && app.signedIn}{#await lazy.tokens() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "content" && app.signedIn}{#await lazy.content() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "groups" && app.signedIn}{#await lazy.groups() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "weekly" && app.signedIn}{#await lazy.weekly() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "helpers" && app.signedIn}{#await lazy.helpers() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "archive" && app.signedIn}{#await lazy.archive() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "cases" && !app.signedIn}{#await lazy.auth() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.screen === "cases" || (app.game && isCaseScreen(app.screen))}{@render room()}
      {:else if app.game && app.screen === "garage"}{#await lazy.garage() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.game && app.screen === "witness" && app.witnessVisit}{#await lazy.witness() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.game && app.screen === "journey" && app.journey}{#await lazy.journey() then { default: Screen }}<Screen {app} loop={app.journey.loop === true} onclose={() => app.leaveJourney()} />{/await}
      {:else if app.game && app.screen === "raid" && app.raidVisit}{#await lazy.raid() then { default: Screen }}<Screen {app} />{/await}
      {:else if app.game && app.screen === "results"}{#await lazy.results() then { default: Screen }}<Screen {app} />{/await}
      {:else}{@render room()}{/if}

      {#snippet failed(error, reset)}
        <div class="crash card" role="alert">
          <h1>Something went wrong</h1>
          <p class="muted">Your case is saved.</p>
          <p class="mono muted">{error instanceof Error ? error.message : String(error)}</p>
          <button class="btn btn-primary" type="button" onclick={() => { reset(); app.go(app.signedIn ? "cases" : "welcome"); }}>Back to safety</button>
        </div>
      {/snippet}
    </svelte:boundary>
    {#if app.signedIn && app.panel}{#await lazy.panel() then { default: Screen }}<Screen {app} />{/await}{/if}
    {#if app.signedIn && app.achievementShare && !app.panel}{#await lazy.achievementShare() then { default: Dialog }}<Dialog {app} />{/await}{/if}
  </Shell>
  <!-- Animated scenes can be made lighter or richer at any moment, without leaving the game. -->
  {#if sceneOptions}{#await lazy.detail() then { default: Control }}{#key app.screen}<Control music={app.music} />{/key}{/await}{/if}
{/if}
