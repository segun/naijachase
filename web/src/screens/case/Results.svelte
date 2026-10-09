<script lang="ts">
  import { onMount } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const solved = $derived(gs.outcome === "solved");
  const timedOut = $derived(gs.outcome === "deadline");
  const parts = $derived(clockParts(gs.elapsed));
  let primaryAction = $state<HTMLButtonElement>();

  onMount(() => {
    if (timedOut) queueMicrotask(() => primaryAction?.focus());
  });
</script>

<div class="results" class:solved class:timeout={timedOut} role={timedOut ? "presentation" : undefined}>
  <div class="results-card card rise" role={timedOut ? "dialog" : undefined} aria-modal={timedOut ? "true" : undefined} aria-labelledby={timedOut ? "deadline-title" : undefined} aria-describedby={timedOut ? "deadline-description" : undefined}>
    <div class="verdict-mark" aria-hidden="true"><Icon name={solved ? "trophy" : "x"} /></div>
    <p class="eyebrow">{app.isReplay ? "Replay finished" : "Case closed"} · {gs.mission_id}</p>
    <h1 id={timedOut ? "deadline-title" : undefined}>{solved ? "Thief caught." : timedOut ? "You're out of time." : "The trail went cold."}</h1>
    <p class="muted lead" id={timedOut ? "deadline-description" : undefined}>{solved ? "Your dossier held up and the warrant stuck." : timedOut ? "The seven-day deadline has passed and the suspect has escaped. This case is now closed." : "The suspect slipped away. Study your notes and try again with a sharper eye."}</p>
    <div class="stamp-mark" role="img" aria-label={solved ? "Arrested" : "Escaped"}>{solved ? "Arrested" : "Escaped"}</div>
    {#if app.isReplay}<p class="badge badge-gold promotion" role="status">Replay: no points, achievements or completion credit awarded</p>{/if}
    {#if app.promotion}<p class="badge badge-gold promotion" role="status"><Icon name="star" />Promoted to {app.promotion}</p>{/if}
    <dl class="facts big">
      <div><dt>Final score</dt><dd>{gs.score.toLocaleString()}</dd></div>
      <div><dt>Rank</dt><dd>{app.summary?.rank ?? "—"}</dd></div>
      <div><dt>Ended</dt><dd>{parts.day} {parts.time}</dd></div>
      <div><dt>Career points</dt><dd>{app.summary ? app.summary.points.toLocaleString() : "—"}</dd></div>
    </dl>
    <div class="row-actions">
      {#if timedOut}
        <button class="btn btn-primary btn-lg" type="button" disabled={Boolean(app.busy)} bind:this={primaryAction} onclick={() => app.startNewCaseAfterResult()}>{app.busy ? "Opening case…" : "Start new case"} <Icon name="arrow" /></button>
        <button class="btn btn-lg" type="button" disabled={Boolean(app.busy)} onclick={() => app.newDesk()}>Close</button>
      {:else}
        <button class="btn btn-primary btn-lg" type="button" onclick={() => app.newDesk()}>Return to case desk <Icon name="arrow" /></button>
        <button class="btn btn-lg" type="button" onclick={() => { app.newDesk(); app.go("archive"); }}>View archive</button>
      {/if}
    </div>
  </div>
</div>
