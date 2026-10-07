<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { MISSION_COUNT, missionId, nextMission, randomMission, ratio, STATES } from "../model.ts";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  let pick = $state("");
  const next = $derived(nextMission(app.playedMissions));
  const earned = $derived(new Map((app.summary?.achievements ?? []).map(a => [a.achievement_id, a.earned_at])));
  const pickNumber = $derived(Number(pick));
  const pickValid = $derived(Number.isInteger(pickNumber) && pickNumber >= 1 && pickNumber <= MISSION_COUNT);
  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Case desk</p>
    <h1>Good to see you, {app.investigator}.</h1>
    <p>The clock starts on Monday at 07:00 and you have seven days to catch the thief.</p>
  </header>

  <section class="stat-row rise" aria-label="Career summary">
    {#if app.summary}
      <div class="stat"><span class="stat-label">Rank</span><strong>{app.summary.rank}</strong></div>
      <div class="stat"><span class="stat-label">Career points</span><strong>{app.summary.points.toLocaleString()}</strong></div>
      <div class="stat"><span class="stat-label">Cases solved</span><strong>{app.summary.solved_cases}</strong></div>
      <div class="stat"><span class="stat-label">Jurisdictions</span><strong>{app.summary.visited_states.length}<small> / {STATES.length}</small></strong></div>
    {:else}
      {#each [1, 2, 3, 4] as n}<div class="stat skeleton" aria-hidden="true"></div>{/each}
    {/if}
  </section>

  {#if app.caseId}
    <section class="card resume rise">
      <div><span class="badge badge-gold">In progress</span><h2>Saved case file</h2><p class="muted">Pick up exactly where you left off.</p></div>
      <button class="btn btn-primary" type="button" disabled={app.busy} onclick={() => app.resume()}>
        {#if app.busy}<span class="spinner"></span>{/if}Resume case <Icon name="arrow" />
      </button>
    </section>
  {/if}

  <section class="card new-case rise" aria-labelledby="new-case-title">
    <div>
      <p class="eyebrow">New case</p>
      <h2 id="new-case-title">{next ? `Case ${next}` : "Every case solved"}</h2>
      <p class="muted">{next
        ? `Your next unplayed case file. ${app.archive.length} of ${MISSION_COUNT} played so far.`
        : "You have played all 1,000 cases. Replay one by choosing its number."}</p>
    </div>
    <div class="new-case-actions">
      {#if next}
        <button class="btn btn-primary btn-lg" type="button" disabled={app.busy} onclick={() => app.openCase(next)}>
          {#if app.busy}<span class="spinner"></span> {app.busyLabel}…{:else}Open next case <Icon name="arrow" />{/if}
        </button>
        <button class="btn" type="button" disabled={app.busy} onclick={() => { const id = randomMission(app.playedMissions); if (id) app.openCase(id); }}>Surprise me</button>
      {/if}
      <form class="pick" onsubmit={(e) => { e.preventDefault(); if (pickValid) app.openCase(missionId(pickNumber)); }}>
        <label class="field"><span>Case number (1–{MISSION_COUNT})</span>
          <input class="input" type="number" min="1" max={MISSION_COUNT} step="1" inputmode="numeric" bind:value={pick} placeholder="e.g. 42" />
        </label>
        <button class="btn" disabled={app.busy || !pickValid}>Open</button>
      </form>
    </div>
  </section>

  {#if app.summary}
    <div class="split">
      <section class="card" aria-labelledby="ach-title">
        <h2 id="ach-title">Achievements</h2>
        <p class="muted">{earned.size} of {app.catalog.length} earned</p>
        <ul class="achievements">
          {#each app.catalog as a}
            <li class:earned={earned.has(a.id)}>
              <span class="ach-icon"><Icon name={earned.has(a.id) ? "trophy" : "lock"} /></span>
              <div><strong>{a.title}</strong><span class="muted">{a.description}</span>{#if earned.has(a.id)}<small class="earned-on">Earned {date(earned.get(a.id)!)}</small>{/if}</div>
            </li>
          {/each}
        </ul>
      </section>
      <aside class="stack side-rail">
        <section class="card">
          <h2>Accuracy</h2>
          <dl class="profile-list">
            <div><dt>Correct travels</dt><dd>{ratio(app.summary.correct_travels, app.summary.wrong_travels)}</dd></div>
            <div><dt>Correct deductions</dt><dd>{ratio(app.summary.correct_deductions, app.summary.wrong_deductions)}</dd></div>
          </dl>
        </section>
        <section class="card">
          <h2>Rank history</h2>
          {#if app.summary.rank_history.length}
            <ol class="trail">
              {#each app.summary.rank_history as r}
                <li class:current={r.new_rank === app.summary.rank}><span class="dot"></span>{r.new_rank}<small class="muted">{date(r.earned_at)}</small></li>
              {/each}
            </ol>
          {:else}<p class="muted">No promotions yet. Solve cases to rise through the ranks.</p>{/if}
        </section>
      </aside>
    </div>
  {/if}
</div>
