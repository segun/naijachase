<script lang="ts">
  import type { AppController } from "../../state/app.svelte";
  import { ApiError, type ContentApi } from "../../api/api";
  import {
    LIFECYCLE_LABEL, allowedTransitions, formatUtc, isMissionId, needsSchedule, reserveSummary, transitionBody,
    type CatalogueHealth, type ContentRole, type Lifecycle, type MissionAdminDetails, type MissionValidation
  } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";

  let { app, api, role }: { app: AppController; api: ContentApi; role: ContentRole } = $props();
  let health = $state<CatalogueHealth | null>(null);
  let lookup = $state("");
  let mission = $state<MissionAdminDetails | null>(null);
  let validation = $state<MissionValidation | null>(null);
  let target = $state<Lifecycle | null>(null);
  let reason = $state("");
  let scheduledLocal = $state("");
  let message = $state("");
  let problem = $state("");
  let busy = $state(false);

  const reserve = $derived(health ? reserveSummary(health) : null);
  const options = $derived(mission ? allowedTransitions(mission.lifecycle_status, role) : []);
  const counts = $derived(health ? [
    ["Draft", health.draft], ["Editorial review", health.editorial_review], ["Validated", health.validated],
    ["Scheduled", health.scheduled], ["Published", health.published], ["Retired", health.retired]
  ] as const : []);

  function report(e: unknown) {
    if (e instanceof ApiError && e.status === 401) { app.go("cases"); return; }
    problem = e instanceof Error ? e.message : String(e);
  }
  async function loadHealth() { try { health = await api.health(); } catch (e) { report(e); } }
  $effect(() => { void loadHealth(); });

  async function open(id: string, keepMessage = false) {
    const clean = id.trim().toUpperCase();
    if (!keepMessage) message = "";
    problem = ""; target = null; reason = ""; validation = null;
    if (!isMissionId(clean)) { problem = "Enter a mission id such as NG-M1001."; return; }
    busy = true;
    try { mission = await api.mission(clean); lookup = clean; validation = await api.validation(clean); }
    catch (e) { mission = null; report(e); }
    finally { busy = false; }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!mission || !target) return;
    const body = transitionBody(target, reason, scheduledLocal);
    if ("error" in body) { problem = body.error; return; }
    busy = true; problem = ""; message = "";
    try {
      await api.transition(mission.mission_id, body);
      message = `${mission.mission_id} is now ${LIFECYCLE_LABEL[body.target_status].toLowerCase()}.`;
      target = null; reason = ""; scheduledLocal = "";
      await Promise.all([open(mission.mission_id, true), loadHealth()]);
    } catch (e) { report(e); }
    finally { busy = false; }
  }
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Restricted · content team</p>
    <h1>Catalogue operations</h1>
    <p>Signed in with the <strong>{role}</strong> role. This area never appears in the player experience, and every change is audited on the server.</p>
  </header>

  <section class="card rise" aria-labelledby="health-title">
    <div class="row-between"><h2 id="health-title">Catalogue health</h2><button class="btn btn-ghost" type="button" onclick={loadHealth}>Refresh</button></div>
    {#if health && reserve}
      {#if reserve.alert}<p class="move-warning" role="alert"><Icon name="alert" />Reserve below target: {reserve.line}. Validate or schedule more missions.</p>{/if}
      <dl class="facts counts">
        {#each counts as [label, n]}<div><dt>{label}</dt><dd>{n.toLocaleString()}</dd></div>{/each}
        <div><dt>Players with no unseen case</dt><dd>{health.exhausted_players}</dd></div>
        <div><dt>Fewest unseen for any player</dt><dd>{health.minimum_unseen_cases.toLocaleString()}</dd></div>
      </dl>
      {#if !reserve.alert}<p class="muted">{reserve.line}. Reserve is healthy.</p>{/if}
    {:else}<p class="muted">Loading…</p>{/if}
  </section>

  <section class="card rise" aria-labelledby="mission-title">
    <h2 id="mission-title">Mission lookup</h2>
    <form class="lookup" onsubmit={(e) => { e.preventDefault(); void open(lookup); }}>
      <label class="field"><span>Mission id</span><input class="input" bind:value={lookup} placeholder="NG-M1001" autocomplete="off" spellcheck="false" /></label>
      <button class="btn btn-primary" disabled={busy || !lookup.trim()}>Inspect</button>
    </form>
    {#if problem}<p class="move-warning" role="alert"><Icon name="alert" />{problem}</p>{/if}
    {#if message}<p class="badge badge-green" role="status">{message}</p>{/if}

    {#if mission}
      <div class="mission-admin">
        <div class="mission-head">
          <h3 class="mono">{mission.mission_id}</h3>
          <span class="badge badge-gold">{LIFECYCLE_LABEL[mission.lifecycle_status as Lifecycle] ?? mission.lifecycle_status}</span>
          <span class="muted">v{mission.content_version} · difficulty {mission.difficulty}</span>
        </div>
        <dl class="profile-list">
          <div><dt>Thief</dt><dd class="mono">{mission.thief_id}</dd></div>
          <div><dt>Anchors</dt><dd class="mono">{mission.anchors.join(", ")}</dd></div>
          <div><dt>Published</dt><dd>{formatUtc(mission.published_at)}</dd></div>
          <div><dt>Scheduled for</dt><dd>{formatUtc(mission.scheduled_for)}</dd></div>
          <div><dt>Retired</dt><dd>{formatUtc(mission.retired_at)}</dd></div>
        </dl>

        {#if validation}
          <div class="validation" class:bad={!validation.valid}>
            <strong>{validation.valid ? "Passes structural validation" : "Validation failed"}</strong>
            {#if validation.issues.length}<ul>{#each validation.issues as issue}<li>{issue}</li>{/each}</ul>{/if}
          </div>
        {/if}

        <h3>Lifecycle</h3>
        {#if options.length === 0}
          <p class="muted">Your role has no lifecycle actions available for this status.</p>
        {:else}
          <div class="row-actions" role="group" aria-label="Lifecycle actions">
            {#each options as t}
              <button class="btn" class:btn-primary={target === t} type="button" aria-pressed={target === t} disabled={busy} onclick={() => { target = t; problem = ""; }}>{LIFECYCLE_LABEL[t]}</button>
            {/each}
          </div>
          {#if target}
            <form class="form transition" onsubmit={submit}>
              <p>Move <strong class="mono">{mission.mission_id}</strong> to <strong>{LIFECYCLE_LABEL[target]}</strong>.</p>
              {#if needsSchedule(target)}
                <label class="field"><span>Release date and time (UTC)</span><input class="input" type="datetime-local" bind:value={scheduledLocal} required /></label>
              {/if}
              <label class="field"><span>Reason (recorded in the audit log)</span><input class="input" bind:value={reason} required minlength="3" maxlength="200" placeholder="e.g. Monday content release batch 2026-W43" /></label>
              <div class="row-actions">
                <button class="btn btn-primary" disabled={busy}>{#if busy}<span class="spinner"></span> {/if}Confirm change</button>
                <button class="btn btn-ghost" type="button" onclick={() => (target = null)}>Cancel</button>
              </div>
            </form>
          {/if}
        {/if}

        <h3>Audit history</h3>
        <ol class="audit">
          {#each [...mission.history].reverse() as h}
            <li>
              <div><strong>{h.from_status ?? "new"} → {h.to_status}</strong><small class="muted"> · v{h.content_version}</small></div>
              <p>{h.reason}</p>
              <small class="muted">{h.actor_player_id} · {formatUtc(h.created_at)}</small>
            </li>
          {:else}<li class="muted">No history yet.</li>{/each}
        </ol>
      </div>
    {/if}
  </section>

  <button class="btn btn-ghost" type="button" onclick={() => { location.hash = ""; app.go("cases"); }}>Back to the case desk</button>
</div>
