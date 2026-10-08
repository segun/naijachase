<script lang="ts">
  import type { AppController } from "../../state/app.svelte";
  import {
    COOP_STATUS, RECOMMENDATION_MAX, REPORT_CATEGORIES, REPORT_DETAILS_MAX, coopActions, coopCounterpart, cooperationAvailable,
    expiresIn, recommendationProblem, sortCoop, venueInfo, type CooperationRequest, type ReportCategory
  } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";
  import MoveDialog from "../case/MoveDialog.svelte";

  let { app }: { app: AppController } = $props();
  const me = $derived(app.player?.username ?? "");
  const prefs = $derived(app.coop.prefs);
  const available = $derived(cooperationAvailable(prefs));
  const requests = $derived(sortCoop(app.coop.requests, me));
  let enabled = $state(false), email = $state(false);
  let writing = $state<string | null>(null), text = $state("");
  let reporting = $state<{ username: string } | null>(null);
  let category = $state<ReportCategory>("harassment"), details = $state("");
  let blocking = $state<string | null>(null);
  let manualBlock = $state("");

  $effect(() => { void app.loadCoop(); });
  $effect(() => { if (prefs) { enabled = prefs.enabled; email = prefs.email_enabled; } });

  const problem = $derived(writing ? recommendationProblem(text) : null);
  async function send(id: string) { if (!problem && await app.coopComplete(id, text)) { writing = null; text = ""; } }
  async function submitReport(event: SubmitEvent) {
    event.preventDefault();
    if (reporting && await app.reportPlayer(reporting.username, category, details)) { reporting = null; details = ""; category = "harassment"; }
  }
  const sceneText = (r: CooperationRequest) => `${venueInfo(r.venue_id).who.split(" and ")[0]} · ${r.public_scene.jurisdiction} · stop ${r.public_scene.stage + 1}`;
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Helpers</p>
    <h1>Investigate together</h1>
    <p>Ask a friend to question one witness and send back a short recommendation. There is no chat, no public directory, no online status and no location sharing. You always make the decisions.</p>
  </header>

  {#if !app.coop.loaded}
    <p class="muted" role="status"><span class="spinner"></span> Loading…</p>
  {:else if !available}
    <section class="card empty rise">
      <Icon name="lock" />
      <h2>Not available on this account</h2>
      <p class="muted">Cooperative investigations are only offered to accounts that are age-confirmed as adult.</p>
    </section>
  {:else}
    <section class="card rise" aria-labelledby="prefs-title">
      <h2 id="prefs-title">Preferences</h2>
      <form class="form" onsubmit={(e) => { e.preventDefault(); void app.setCoopPreferences(enabled, email); }}>
        <label class="check"><input type="checkbox" bind:checked={enabled} /> Allow help requests to and from me</label>
        <label class="check"><input type="checkbox" bind:checked={email} disabled={!enabled} /> Email me about requests</label>
        <div class="row-actions"><button class="btn btn-primary" disabled={app.busy}>Save preferences</button></div>
      </form>
      <p class="muted">Helper reputation: <strong>{app.coop.reputation}</strong>. It is a thank-you score only and never affects gameplay.</p>
    </section>

    <section class="stack rise" aria-labelledby="req-title">
      <h2 id="req-title">Requests</h2>
      {#each requests as r (r.request_id)}
        {@const status = COOP_STATUS[r.status]}
        {@const actions = coopActions(r, me)}
        {@const other = coopCounterpart(r, me)}
        <article class="card coop">
          <div class="row-between">
            <div>
              <strong>{r.owner_username === me ? `You asked ${r.helper_username}` : `${r.owner_username} asked you`}</strong>
              <p class="muted">{sceneText(r)}</p>
            </div>
            <span class="badge badge-{status.tone === 'muted' ? '' : status.tone}">{status.label}</span>
          </div>
          {#if !status.terminal}<small class="muted">{expiresIn(r.expires_at)}</small>{/if}
          {#if r.recommendation}
            <figure class="recommendation">
              <figcaption class="muted">Recommendation from {r.helper_username}</figcaption>
              <blockquote>{r.recommendation.text}</blockquote>
              <small class="muted">Treat this as a suggestion from another player. Check it against your own notes.</small>
            </figure>
          {/if}
          {#if r.reward_granted}<small class="muted"><Icon name="check" /> Thanks recorded</small>{/if}

          {#if writing === r.request_id}
            <form class="form" onsubmit={(e) => { e.preventDefault(); void send(r.request_id); }}>
              <label class="field"><span>Your recommendation</span>
                <textarea class="input" rows="3" bind:value={text} maxlength={RECOMMENDATION_MAX} placeholder="e.g. Check the cloth description carefully."></textarea>
              </label>
              <small class={problem ? "hint warn" : "hint muted"}>{problem ?? `${text.trim().length}/${RECOMMENDATION_MAX}`}</small>
              <div class="row-actions">
                <button class="btn btn-primary" disabled={app.busy || !!problem}>Send recommendation</button>
                <button class="btn btn-ghost" type="button" onclick={() => (writing = null)}>Cancel</button>
              </div>
            </form>
          {:else}
            <div class="row-actions">
              {#each actions as action}
                {#if action === "complete"}
                  <button class="btn btn-primary" type="button" onclick={() => { writing = r.request_id; text = ""; }}>Write recommendation</button>
                {:else}
                  <button class="btn" class:btn-primary={action === "accept" || action === "acknowledge"} type="button" disabled={app.busy} onclick={() => app.coopAct(r.request_id, action)}>
                    {action === "accept" ? "Accept" : action === "decline" ? "Decline" : "Say thanks"}
                  </button>
                {/if}
              {/each}
              <button class="btn btn-ghost" type="button" onclick={() => (blocking = other)}><Icon name="flag" />Block</button>
              <button class="btn btn-ghost" type="button" onclick={() => (reporting = { username: other })}><Icon name="alert" />Report</button>
            </div>
          {/if}
        </article>
      {:else}
        <p class="muted">No requests yet. Ask for help from the Investigate screen.</p>
      {/each}
    </section>

    <section class="card rise" aria-labelledby="blocks-title">
      <h2 id="blocks-title">Blocked players</h2>
      <ul class="devices">
        {#each app.coop.blocks as [id, name] (id)}
          <li><span class="device-icon"><Icon name="lock" /></span><div><strong>{name}</strong></div><button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => app.unblockPlayer(id)}>Unblock</button></li>
        {:else}<li class="muted">You haven't blocked anyone.</li>{/each}
      </ul>
      <form class="lookup" onsubmit={(e) => { e.preventDefault(); blocking = manualBlock.trim(); }}>
        <label class="field"><span>Block someone by exact username</span><input class="input" bind:value={manualBlock} autocomplete="off" spellcheck="false" /></label>
        <button class="btn" disabled={manualBlock.trim().length < 3}>Block</button>
      </form>
    </section>
  {/if}
</div>

{#if blocking}
  <MoveDialog title="Block {blocking}?" subtitle="Pending requests between you will be cancelled, and neither of you can ask the other for help." onclose={() => (blocking = null)}>
    <div class="row-actions">
      <button class="btn btn-danger" type="button" disabled={app.busy} onclick={async () => { if (blocking && await app.blockPlayer(blocking)) { blocking = null; manualBlock = ""; } }}>Yes, block</button>
      <button class="btn btn-ghost" type="button" onclick={() => (blocking = null)}>Cancel</button>
    </div>
  </MoveDialog>
{/if}

{#if reporting}
  <MoveDialog title="Report {reporting.username}" subtitle="Reports are private. The other player is never told who reported them." onclose={() => (reporting = null)}>
    <form class="form" onsubmit={submitReport}>
      <label class="field"><span>What happened?</span>
        <select class="select" bind:value={category}>{#each REPORT_CATEGORIES as c}<option value={c.id}>{c.label}</option>{/each}</select>
      </label>
      <label class="field"><span>Details (optional)</span><textarea class="input" rows="3" bind:value={details} maxlength={REPORT_DETAILS_MAX}></textarea></label>
      <div class="row-actions">
        <button class="btn btn-primary" disabled={app.busy}>Send report</button>
        <button class="btn btn-ghost" type="button" onclick={() => (reporting = null)}>Cancel</button>
      </div>
    </form>
  </MoveDialog>
{/if}
