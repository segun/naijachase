<script lang="ts">
  import type { Snippet } from "svelte";
  import type { AppController } from "../lib/app.svelte";
  import { dossierCount, initials, type Screen } from "../model.ts";
  import Brand from "./Brand.svelte";
  import Hud from "./Hud.svelte";
  import Icon from "./Icon.svelte";
  import Toasts from "./Toasts.svelte";

  let { app, children }: { app: AppController; children: Snippet } = $props();

  const inCase = $derived(app.game !== null && app.screen !== "results");
  const rail = $derived(app.signedIn && app.screen !== "welcome");

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
          { id: "archive", label: "Case archive", icon: "archive", count: app.archive.length ? String(app.archive.length) : undefined }
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
      <div class="profile">
        <div class="profile-head">
          <span class="avatar" aria-hidden="true">{initials(app.investigator)}</span>
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
    {#if inCase}<Hud {app} />{/if}
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
<Toasts {app} />
