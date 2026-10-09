<script lang="ts">
  import type { Snippet } from "svelte";
  import type { AppController } from "../state/app.svelte";
  import { coopActions, dossierCount, initials, isCaseScreen, type Screen } from "../domain/model.ts";
  import AvatarSilhouette from "../avatar/AvatarSilhouette.svelte";
  import Brand from "./Brand.svelte";
  import Hud from "./Hud.svelte";
  import Icon from "./Icon.svelte";
  import MusicToggle from "../music/MusicToggle.svelte";
  import Toasts from "./Toasts.svelte";

  let { app, children }: { app: AppController; children: Snippet } = $props();

  const inCase = $derived(app.game !== null && app.screen !== "results");
  // The rooms (the desk, the case on the office computer, the archive, the garage and the witness scene) are full-screen: their own menus replace the side rail.
  const inRoom = $derived(["welcome", "cases", "archive", "garage", "witness"].includes(app.screen) || (app.game !== null && isCaseScreen(app.screen)));
  const rail = $derived(app.signedIn && !inRoom && !app.needsAvatar);

  const waiting = $derived(app.coop.requests.filter(r => coopActions(r, app.player?.username ?? "").length).length);
  type Item = { id: Screen; label: string; icon: string; count?: string };
  const items = $derived<Item[]>(
    inCase
      ? [
          { id: "investigate", label: "Investigate", icon: "search" },
          { id: "notebook", label: "Notebook", icon: "notebook", count: String(app.notes.length) },
          { id: "dossier", label: "Dossier", icon: "id", count: `${dossierCount(app.game!.state.dossier)}/8` },
          { id: "travel", label: "Travel", icon: "plane" },
          { id: "warrant", label: "Warrant", icon: "warrant" }
        ]
      : [
          { id: "cases", label: "Case desk", icon: "home" },
          { id: "archive", label: "Case archive", icon: "archive", count: app.archive.length ? String(app.archive.length) : undefined },
          { id: "groups", label: "Groups", icon: "users", count: app.groups.invitations.length ? String(app.groups.invitations.length) : undefined },
          { id: "weekly", label: "Weekly", icon: "trophy" },
          { id: "helpers", label: "Helpers", icon: "helper", count: waiting ? String(waiting) : undefined }
        ]
  );
</script>

<a class="skip-link" href="#main">Skip to investigation</a>
{#if app.busy}<div class="loading-bar" role="presentation"></div>{/if}

<div class="app" class:no-rail={!rail}>
  {#if rail}
    <aside class="sidebar">
      <Brand />
      <nav class="nav" aria-label="Case tools">
        {#each items as item}
          <button class="nav-item" type="button" aria-current={app.screen === item.id ? "page" : undefined} onclick={() => app.go(item.id)}>
            <Icon name={item.icon} /><span>{item.label}</span>{#if item.count}<span class="count">{item.count}</span>{/if}
          </button>
        {/each}
      </nav>
      <div class="nav-spacer"></div>
      <div class="music-side"><MusicToggle music={app.music} /></div>
      <div class="profile">
        <div class="profile-head">
          <span class="avatar" class:has-avatar={app.avatar !== null} aria-hidden="true">{#if app.avatar}<AvatarSilhouette preset={app.avatar} crop="bust" />{:else}{initials(app.investigator)}{/if}</span>
          <div><strong>{app.investigator}</strong><small>{app.summary?.rank ?? "Investigator"}</small></div>
        </div>
        <small class="hint">{app.summary ? `${app.summary.points.toLocaleString()} career points` : "Career points loading…"}</small>
      </div>
      <nav class="nav" aria-label="Account">
        <button class="nav-item" type="button" aria-current={app.screen === "settings" ? "page" : undefined} onclick={() => app.go("settings")}><Icon name="sliders" /><span>Settings</span></button>
        <button class="nav-item" type="button" disabled={app.busy} onclick={() => app.logout()}><Icon name="logout" /><span>Log out</span></button>
      </nav>
    </aside>
  {/if}

  <div class="content">
    {#if inCase && !inRoom}<Hud {app} />{/if}
    <main id="main" tabindex="-1">{@render children()}</main>
  </div>
</div>

{#if rail}
  <nav class="bottom-nav" aria-label="Case tools">
    {#each items as item}
      <button type="button" aria-current={app.screen === item.id ? "page" : undefined} onclick={() => app.go(item.id)}><Icon name={item.icon} />{item.label}</button>
    {/each}
    <button type="button" aria-current={app.screen === "settings" ? "page" : undefined} onclick={() => app.go("settings")}><Icon name="sliders" />Settings</button>
  </nav>
{/if}
{#if app.signedIn}<div class="music-dock" class:with-rail={rail}><MusicToggle music={app.music} /></div>{/if}
<Toasts {app} />
