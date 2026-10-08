<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { ATTEMPT_LABEL, duration, ratio, replayTargets } from "../model.ts";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  const solved = (outcome: string) => outcome === "solved";
  const replayable = $derived(replayTargets(app.archive));
  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Case archive</p>
    <h1>Closed cases</h1>
    <p>Every case you have finished and the thief behind it. Replay a solved case any time; replays award no points or achievements.</p>
  </header>

  {#if app.archive.length === 0}
    <section class="card empty rise">
      <Icon name="archive" />
      <h2>Nothing filed yet</h2>
      <p class="muted">Finished cases appear here with their score, route and thief.</p>
      <button class="btn btn-primary" type="button" onclick={() => app.go("cases")}>Back to the case desk</button>
    </section>
  {:else}
    <ul class="archive">
      {#each app.archive as entry, i (entry.case_id)}
        <li class="card rise" style:animation-delay="{Math.min(i, 8) * 0.04}s">
          <div class="archive-head">
            <span class="mono">{entry.mission_id}</span>
            <span class="badge-row">
              {#if entry.first_completion}<span class="badge badge-green">First solve</span>{/if}
              {#if entry.attempt_kind !== "ordinary"}<span class="badge badge-gold">{ATTEMPT_LABEL[entry.attempt_kind]}</span>{/if}
              <span class="badge" class:badge-green={solved(entry.outcome)} class:badge-red={!solved(entry.outcome)}>{entry.outcome.replaceAll("_", " ")}</span>
            </span>
          </div>
          <h2>Thief {entry.thief_id}</h2>
          <dl class="facts">
            <div><dt>Score</dt><dd>{entry.score.toLocaleString()}</dd></div>
            <div><dt>Time used</dt><dd>{duration(entry.elapsed_minutes)}</dd></div>
            <div><dt>Stops</dt><dd>{entry.states_visited.length}</dd></div>
            <div><dt>Travels</dt><dd>{ratio(entry.correct_travels, entry.wrong_travels)}</dd></div>
          </dl>
          <p class="muted route">{entry.states_visited.join(" → ")}</p>
          {#if replayable.has(entry.case_id)}
            <button class="btn" type="button" disabled={app.busy} onclick={() => app.replayCase(entry.mission_id)}>Replay case <Icon name="arrow" /></button>
          {/if}
          <small class="muted">Closed {date(entry.completed_at)} · deductions {ratio(entry.correct_deductions, entry.wrong_deductions)} correct</small>
        </li>
      {/each}
    </ul>
  {/if}
</div>
