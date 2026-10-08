<script lang="ts">
  // Ten server-owned presets as selectable cards. Previews are procedural Babylon.js stills; when WebGL is unavailable or
  // the device is in a low-power state the same fields are drawn as an SVG silhouette. The browser never invents presets.
  import { onMount, untrack } from "svelte";
  import type { ApiError } from "../api";
  import type { AppController } from "../lib/app.svelte";
  import { avatarRenderer, catalogueProblem, skinToneLabel, hairLabel, type AvatarCatalogue } from "../lib/avatar-model.ts";
  import { readDevice } from "../lib/scene-capability.ts";
  import AvatarSilhouette from "./AvatarSilhouette.svelte";
  import Icon from "./Icon.svelte";

  let { app, first = false }: { app: AppController; first?: boolean } = $props();

  const PREVIEW_TIMEOUT_MS = 15000;
  let catalogue = $state<AvatarCatalogue | null>(null);
  let loading = $state(true);
  let loadError = $state("");
  let saveError = $state("");
  let saved = $state(false);
  let selected = $state<string | null>(untrack(() => app.avatar?.avatar_id ?? app.player?.avatar_id ?? null));
  let images = $state<Record<string, string>>({});

  const dirty = $derived(selected !== null && selected !== (app.player?.avatar_setup_complete ? app.player.avatar_id : null));
  const chosenLabel = $derived(catalogue?.options.find(o => o.avatar_id === selected)?.label ?? "");

  async function load() {
    loading = true; loadError = ""; images = {}; catalogue = null;
    const out = await app.loadAvatarOptions(e => { loadError = e.message; return e.status !== 401; });
    loading = false;
    if (!out) { if (!loadError) loadError = "Avatars could not be loaded. Please try again."; return; }
    const problem = catalogueProblem(out);
    if (problem) { loadError = problem; return; }
    catalogue = out;
    if (selected && !out.options.some(o => o.avatar_id === selected)) selected = null;
  }

  async function save() {
    if (!selected) return;
    saveError = ""; saved = false;
    const ok = await app.chooseAvatar(selected, (e: ApiError) => { saveError = e.status === 400 ? "That avatar is no longer available. Please choose another." : e.message; return e.status !== 401; });
    if (!ok) return;
    saved = true;
    app.toast(first ? "Avatar saved. Your case desk is ready." : "Avatar updated.", "success");
    if (first) app.go("cases");
  }

  onMount(() => { void load(); });

  // Stills are rendered once per catalogue load; cards show the silhouette until their own preview arrives.
  $effect(() => {
    const current = catalogue;
    if (!current || avatarRenderer(readDevice()) !== "webgl") return;
    let cancelled = false;
    const timer = setTimeout(() => { cancelled = true; }, PREVIEW_TIMEOUT_MS);
    import("../lib/avatar3d.ts")
      .then(m => m.renderAvatarSnapshots(current.options, {
        isCancelled: () => cancelled,
        onSnapshot: (id, url) => { if (!cancelled) images[id] = url; }
      }))
      .catch(() => { /* the silhouettes already on screen are the fallback */ })
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); };
  });
</script>

<section class="avatar-picker" aria-labelledby="avatar-title" aria-busy={loading}>
  <header class="page-head">
    {#if first}<p class="eyebrow">Welcome, {app.investigator}</p>{/if}
    {#if first}<h1 id="avatar-title">Choose your investigator</h1>{:else}<h2 id="avatar-title">Avatar</h2>{/if}
    <p>{first ? "Pick one of ten investigators to represent you. It is only how you look: it never changes clues, ranking or gameplay, and you can change it later in Settings." : "Change how your investigator looks. It never affects clues, ranking, eligibility or gameplay."}</p>
  </header>

  {#if loading}
    <p class="muted" role="status">Loading avatars…</p>
  {:else if loadError}
    <div class="avatar-error" role="alert">
      <p>{loadError}</p>
      <button class="btn" type="button" onclick={load}>Try again</button>
    </div>
  {:else if catalogue}
    <fieldset class="avatar-set">
      <legend class="sr-only">Avatar choices</legend>
      <div class="avatar-grid">
        {#each catalogue.options as o (o.avatar_id)}
          <label class="avatar-card" class:selected={selected === o.avatar_id}>
            <input class="sr-only" type="radio" name="avatar" value={o.avatar_id} bind:group={selected} onchange={() => { saved = false; saveError = ""; }} aria-describedby={`avatar-desc-${o.avatar_id}`} />
            <span class="avatar-preview" aria-hidden="true">
              {#if images[o.avatar_id]}<img src={images[o.avatar_id]} alt="" width="140" height="175" />{:else}<AvatarSilhouette preset={o} />{/if}
            </span>
            <span class="avatar-name">{o.label}</span>
            <span class="avatar-meta" id={`avatar-desc-${o.avatar_id}`}>Skin tone: {skinToneLabel(o)}<br />Hair: {hairLabel(o)}</span>
            <span class="avatar-state" aria-hidden="true">{#if selected === o.avatar_id}<Icon name="check" /> Selected{:else}&nbsp;{/if}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    {#if saveError}<p class="avatar-error" role="alert">{saveError}</p>{/if}
    <div class="row-actions avatar-actions">
      <button class="btn btn-primary btn-lg" type="button" disabled={app.busy || selected === null || (!first && !dirty)} onclick={save}>
        {first ? "Continue to case desk" : "Save avatar"}
      </button>
      {#if first}<button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => app.logout()}>Log out</button>{/if}
      <span class="hint" role="status">
        {#if saved}Saved: {chosenLabel}.{:else if selected === null}Choose an avatar to continue.{:else if dirty}{chosenLabel} selected. Not saved yet.{/if}
      </span>
    </div>
  {/if}
</section>
