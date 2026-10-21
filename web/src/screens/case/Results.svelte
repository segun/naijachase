<script lang="ts">
  import "../../styles/warrant.css";
  import { onMount } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts } from "../../domain/model.ts";
  import { formatWhen, tokensEarned, totalAwarded } from "../../domain/pressure.ts";
  import Icon from "../../ui/Icon.svelte";
  import { markResultsAfterPaint } from "../../ui/results-presentation.svelte.ts";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const solved = $derived(gs.outcome === "solved");
  const timedOut = $derived(gs.outcome === "deadline");
  const wrongWarrant = $derived(gs.outcome === "escaped" && !!gs.warrant_suspect);
  const forfeited = $derived(gs.outcome === "forfeited");
  const popup = $derived(timedOut || wrongWarrant || forfeited);
  const awards = $derived(app.awards);
  const arrestMessage = $derived.by(() => {
    const item = gs.case_dossier?.stolen_item;
    const place = app.trail[0] || /\bfrom ([^.,]+?)(?:[.,]| and |$)/.exec(gs.case_dossier?.premise ?? "")?.[1];
    const who = gs.resolved_thief_name ?? gs.warrant_suspect ?? "The thief";
    const returned = item ? ` and ${item} has been returned${place ? ` to ${place}` : ""}` : "";
    return `${who} has been arrested${returned}. Your dossier held up and the warrant stuck.`;
  });
  const parts = $derived(clockParts(gs.elapsed));
  let primaryAction = $state<HTMLButtonElement>();

  onMount(() => {
    if (popup) queueMicrotask(() => primaryAction?.focus());
    return markResultsAfterPaint(app.caseId);
  });
</script>

<div class="results" class:solved class:timeout={popup} role={popup ? "presentation" : undefined}>
  <div class="results-card card rise" role={popup ? "dialog" : undefined} aria-modal={popup ? "true" : undefined} aria-labelledby={popup ? "case-ended-title" : undefined} aria-describedby={popup ? "case-ended-description" : undefined}>
    <div class="verdict-mark" aria-hidden="true"><Icon name={solved ? "trophy" : "x"} /></div>
    <p class="eyebrow">{app.isWeekly ? "Weekly challenge" : app.isReplay ? "Replay finished" : "Case closed"} · {gs.mission_id}</p>
    <h1 id={popup ? "case-ended-title" : undefined}>{solved ? "Thief caught." : forfeited ? "Case forfeited." : timedOut ? "You're out of time." : wrongWarrant ? "The warrant was wrong." : "The trail went cold."}</h1>
    <p class="muted lead" id={popup ? "case-ended-description" : undefined}>{solved ? arrestMessage : forfeited ? `The disciplinary panel suspended you from missions${app.jailedUntil ? ` until ${formatWhen(app.jailedUntil)}` : ""}, so this case was forfeited. Settings and your history stay available.` : timedOut ? "The seven-day deadline has passed and the suspect has escaped. This case is now closed." : wrongWarrant ? `You caught up with ${gs.resolved_thief_name ?? "the real thief"}, but unfortunately the suspect avoided arrest because your warrant named the wrong person. This case is now closed.` : "The suspect slipped away. Study your notes and try again with a sharper eye."}</p>
    <div class="stamp-mark" role="img" aria-label={solved ? "Arrested" : "Escaped"}>{solved ? "Arrested" : "Escaped"}</div>
    {#if app.isReplay}<p class="badge badge-gold promotion" role="status">Replay: no points, achievements or completion credit awarded</p>{/if}
    {#if app.promotion}<p class="badge badge-gold promotion" role="status"><Icon name="star" />Promoted to {app.promotion}</p>{/if}
    <dl class="facts big">
      <div><dt>Final score</dt><dd>{gs.score.toLocaleString()}</dd></div>
      {#if !app.isWeekly}<div><dt>Rank</dt><dd>{app.summary?.rank ?? "—"}</dd></div>{/if}
      <div><dt>Ended</dt><dd>{parts.day} {parts.time}</dd></div>
      {#if !app.isWeekly}<div><dt>Career points</dt><dd>{app.summary ? app.summary.points.toLocaleString() : "—"}</dd></div>{/if}
    </dl>
    {#if awards.length}
      <section class="token-awards" aria-labelledby="token-awards-title">
        <h2 id="token-awards-title">{tokensEarned(totalAwarded(awards))}</h2>
        <ul>
          {#each awards as award}
            <li>
              <strong>{award.reasonLabel}: {award.amount > 0 ? "+" : ""}{award.amount}</strong>
              {#if award.components.length}<small class="muted">{award.components.join(" · ")}</small>{/if}
              <small class="muted">Balance {award.balanceAfter}</small>
            </li>
          {/each}
        </ul>
        <p class="muted">Awards are capped per case, per day and by the 20-token limit, so the total can be lower than the list of what qualified. Tokens are earned only by playing and cannot be bought.</p>
      </section>
    {:else if solved && !app.isReplay && !app.isWeekly}
      <p class="muted token-note">No bribe tokens were awarded for this case. See your token history in Settings.</p>
    {/if}
    <div class="row-actions">
      {#if app.isWeekly}
        <button class="btn btn-primary btn-lg" type="button" bind:this={primaryAction} onclick={() => app.exitWeekly("weekly")}>Back to the weekly challenge <Icon name="arrow" /></button>
      {:else if popup}
        <button class="btn btn-primary btn-lg" type="button" disabled={Boolean(app.busy) || app.jailedUntil !== null} bind:this={primaryAction} onclick={() => app.startNewCaseAfterResult()}>{app.busy ? "Opening case…" : "Start new case"} <Icon name="arrow" /></button>
        <button class="btn btn-lg" type="button" disabled={Boolean(app.busy)} onclick={() => app.newDesk()}>Close</button>
      {:else}
        <button class="btn btn-primary btn-lg" type="button" onclick={() => app.newDesk()}>Return to case desk <Icon name="arrow" /></button>
        <button class="btn btn-lg" type="button" onclick={() => { app.newDesk(); app.go("archive"); }}>View archive</button>
      {/if}
    </div>
  </div>
</div>
