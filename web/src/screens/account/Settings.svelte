<script lang="ts">
  import { untrack } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { HOME_BASES, STATES } from "../../domain/model.ts";
  import AvatarPicker from "../../avatar/AvatarPicker.svelte";
  import Icon from "../../ui/Icon.svelte";

  let { app }: { app: AppController } = $props();
  const p = untrack(() => app.player);
  let displayName = $state(p?.display_name ?? ""), pronouns = $state(p?.pronouns ?? ""), sex = $state(p?.sex ?? "");
  let homeBase = $state(p?.home_base ?? "Lagos");
  let loadedPlayer = $state(p?.player_id ?? "");
  let confirmAll = $state(false);
  const homeOptions = $derived(HOME_BASES.includes(homeBase as never) ? HOME_BASES : STATES);
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const blank = (v: string) => (v.trim() === "" ? null : v.trim());

  $effect(() => { if (app.signedIn) untrack(() => { void app.loadSessions(); }); });
  $effect(() => {
    const player = app.player;
    if (!player || player.player_id === loadedPlayer) return;
    loadedPlayer = player.player_id;
    displayName = player.display_name ?? "";
    pronouns = player.pronouns ?? "";
    sex = player.sex ?? "";
    homeBase = player.home_base;
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const current = app.player;
    if (!current) return;
    await app.saveProfile({
      display_name: blank(displayName), pronouns: blank(pronouns), sex: blank(sex),
      home_base: homeBase, leaderboard_opt_in: current.leaderboard_opt_in
    });
  }
</script>

<div class="page narrow">
  <header class="page-head rise">
    <p class="eyebrow">Settings</p>
    <h1>Settings</h1>
    <p>Display options are stored on this device only. Profile and devices belong to your account.</p>
  </header>

  <section class="card settings rise">
    <h2>Display</h2>
    <fieldset>
      <legend>Text size</legend>
      <div class="segmented">
        <button type="button" aria-pressed={app.settings.textSize === "normal"} onclick={() => app.updateSettings({ textSize: "normal" })}>Standard</button>
        <button type="button" aria-pressed={app.settings.textSize === "large"} onclick={() => app.updateSettings({ textSize: "large" })}>Large</button>
      </div>
    </fieldset>
    <fieldset>
      <legend>Contrast</legend>
      <div class="segmented">
        <button type="button" aria-pressed={app.settings.contrast === "normal"} onclick={() => app.updateSettings({ contrast: "normal" })}>Standard</button>
        <button type="button" aria-pressed={app.settings.contrast === "high"} onclick={() => app.updateSettings({ contrast: "high" })}>High contrast</button>
      </div>
    </fieldset>
    <fieldset>
      <legend>Motion</legend>
      <div class="segmented">
        <button type="button" aria-pressed={app.settings.motion === "system"} onclick={() => app.updateSettings({ motion: "system" })}>Follow device</button>
        <button type="button" aria-pressed={app.settings.motion === "reduced"} onclick={() => app.updateSettings({ motion: "reduced" })}>Reduce motion</button>
      </div>
    </fieldset>
  </section>

  {#if app.player}
    <section class="card settings rise">
      <h2>Profile</h2>
      <p class="muted">Signed in as <strong>{app.player.username}</strong> ({app.player.email}). Optional fields are visible only to you.</p>
      <p class="profile-fact"><Icon name="pin" /><span>Current home base</span><strong>{app.player.home_base}</strong></p>
      <form class="form" onsubmit={save}>
        <label class="field"><span>Display name</span><input class="input" bind:value={displayName} maxlength="64" placeholder="Shown instead of your username" /></label>
        <label class="field"><span>Pronouns (optional)</span><input class="input" bind:value={pronouns} maxlength="64" /></label>
        <label class="field"><span>Sex (optional)</span><input class="input" bind:value={sex} maxlength="64" /></label>
        <label class="field"><span>Change home base</span>
          <select class="select" bind:value={homeBase}>{#each homeOptions as s}<option>{s}</option>{/each}</select>
        </label>
        <button class="btn btn-primary" disabled={app.busy}>Save profile</button>
      </form>
    </section>

    <section class="card settings rise"><AvatarPicker {app} /></section>

    <section class="card settings rise" aria-labelledby="tokens-link-title">
      <h2 id="tokens-link-title">Bribe tokens and discipline</h2>
      <p class="muted">Your balance, token history and disciplinary record have their own page.</p>
      <button class="btn" type="button" onclick={() => app.go("tokens")}>Open bribe tokens <Icon name="arrow" /></button>
    </section>

    <section class="card settings rise" aria-labelledby="devices-title">
      <h2 id="devices-title">Devices</h2>
      <p class="muted">Sessions expire after 24 hours and rotate while you play.</p>
      <ul class="devices">
        {#each app.sessions as s (s.session_id)}
          <li>
            <span class="device-icon"><Icon name="lock" /></span>
            <div>
              <span class="device-title"><strong>{s.device_label ?? "Unnamed device"}</strong>{#if s.current}<span class="badge badge-green">This device</span>{/if}</span>
              <small class="muted">Last active {when(s.last_seen_at)} · expires {when(s.expires_at)}</small>
            </div>
            {#if !s.current}<button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => app.revokeSession(s.session_id)}>Sign out</button>{/if}
          </li>
        {:else}<li class="muted">No other sessions.</li>{/each}
      </ul>
      {#if !confirmAll}
        <button class="btn btn-danger" type="button" onclick={() => (confirmAll = true)}>Sign out of all devices</button>
      {:else}
        <div class="confirm" role="alertdialog" aria-labelledby="all-title">
          <h3 id="all-title">Sign out everywhere?</h3>
          <p class="muted">Every device, including this one, will need to log in again.</p>
          <div class="row-actions">
            <button class="btn btn-danger" type="button" disabled={app.busy} onclick={() => app.logoutAll()}>Yes, sign out everywhere</button>
            <button class="btn btn-ghost" type="button" onclick={() => (confirmAll = false)}>Cancel</button>
          </div>
        </div>
      {/if}
    </section>
  {/if}
</div>
