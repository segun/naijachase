<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { TOTAL_STOPS, cheapest, clockParts, dayPart, cooperationAvailable, dossierCount, duration, groupQuotes, money, questionedHere, venueInfo, zoneOf, type QuoteGroup, type TransportQuote } from "../model.ts";
  import AskForHelp from "./AskForHelp.svelte";
  import Icon from "./Icon.svelte";
  import MoveDialog from "./MoveDialog.svelte";
  import MoveOptions from "./MoveOptions.svelte";
  import Stepper from "./Stepper.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const done = $derived(questionedHere(gs));
  const here = $derived(app.notes.filter(n => n.stop === gs.current_state).slice(-3));
  const part = $derived(dayPart(clockParts(gs.elapsed).hour));
  const venueIcon = (name: string) => venueInfo(name.toLowerCase().replaceAll(" ", "_")).icon;

  // Venues come from the server's local quotes; one already questioned here may no longer be quoted.
  const venues = $derived.by(() => {
    const quoted = groupQuotes(app.quotes, "local");
    const ids = new Set(quoted.map(g => g.id));
    const extra: QuoteGroup[] = done.filter(id => !ids.has(id)).map(id => ({ id, label: id.replaceAll("_", " "), options: [] }));
    return [...quoted, ...extra];
  });
  let choosing = $state<QuoteGroup | null>(null);
  let pendingVenue = $state("");

  async function question(group: QuoteGroup, quote: TransportQuote) {
    pendingVenue = group.id;
    const ok = await app.command({ type: "visit_venue", venue_id: group.id, mode: quote.mode as "drive" | "hitch_ride" }, "Witness interviewed.", "Interviewing witness");
    pendingVenue = "";
    if (ok) choosing = null;
  }
</script>

{#if choosing}
  <MoveDialog title="Visit the {choosing.label.toLowerCase()}" subtitle="Choose how to get there. The server confirms the fare and time." onclose={() => (choosing = null)}>
    <MoveOptions group={choosing} elapsed={gs.elapsed} balance={gs.balance} busy={app.busy} confirmLabel="Go and question witnesses" working="Interviewing witness" onconfirm={(q) => question(choosing!, q)} oncancel={() => (choosing = null)} />
  </MoveDialog>
{/if}

<div class="page investigate">
  {#key gs.current_state}
    <section class="scene-banner rise">
      <div>
        <p class="eyebrow">{#if app.isReplay}<span class="badge badge-gold replay-banner">Replay · no points</span> {/if}Stop {Math.min(gs.stage + 1, TOTAL_STOPS)} of {TOTAL_STOPS} · {part}</p>
        <h1>{gs.current_state}</h1>
        <p class="muted">{zoneOf(gs.current_state) ?? "Nigeria"} · {done.length} of {venues.length || "…"} witnesses questioned</p>
      </div>
      <Stepper stage={gs.stage} />
    </section>
  {/key}

  <div class="split">
    <section aria-labelledby="leads-title" class="stack">
      <h2 id="leads-title">Local leads</h2>
      <p class="muted">Listen for a destination clue and a detail about the suspect. One witness here knows where the thief went next.</p>
      <div class="venues">
        {#if !app.quotesLoaded}
          {#each [1, 2, 3] as n}<div class="venue skeleton-card" aria-hidden="true"></div>{/each}
        {:else if venues.length === 0}
          <p class="muted">No one is available to question right now.</p>
        {/if}
        {#each venues as venue, i (venue.id)}
          {@const info = venueInfo(venue.id)}
          {@const seen = done.includes(venue.id)}
          {@const best = cheapest(venue.options.filter(o => o.affordable))}
          {@const working = app.busy && pendingVenue === venue.id}
          <button class="venue rise" class:seen type="button" disabled={app.busy || seen || venue.options.length === 0} style:animation-delay="{i * 0.08}s" onclick={() => (choosing = venue)}>
            <span class="venue-icon"><Icon name={info.icon} /></span>
            <span class="venue-body">
              <strong>{venue.label}</strong>
              <span class="muted">{info.who}</span>
              <span class="venue-blurb">{info.blurb}</span>
            </span>
            <span class="venue-status">
              {#if working}<span class="spinner"></span> Questioning
              {:else if seen}<Icon name="check" /> Questioned
              {:else if best}{best.cost === 0 ? "Free" : money(best.cost)} · {duration(best.travel_minutes + best.wait_minutes)} <Icon name="arrow" />
              {:else}Unavailable{/if}
            </span>
          </button>
        {/each}
      </div>

      {#if here.length}
        <section class="log" aria-label="Latest witness accounts">
          <h2>What you heard</h2>
          {#each here as note}
            <div class="bubble rise">
              <span class="bubble-icon"><Icon name={venueIcon(note.venue)} /></span>
              <div><strong class="bubble-who">{note.venue}</strong><blockquote>{note.message}</blockquote></div>
            </div>
          {/each}
        </section>
      {/if}
    </section>

    <aside class="stack side-rail">
      <section class="card snapshot">
        <h2>Case snapshot</h2>
        <dl class="facts">
          <div><dt>Score</dt><dd>{gs.score.toLocaleString()}</dd></div>
          <div><dt>Funds</dt><dd>{money(gs.balance)}</dd></div>
          <div><dt>Dossier</dt><dd>{dossierCount(gs.dossier)}/8</dd></div>
          <div><dt>Notes</dt><dd>{app.notes.length}</dd></div>
        </dl>
      </section>
      <section class="card next-step">
        <h2>Next move</h2>
        {#if done.length === 0}
          <p class="muted">Start by questioning someone. Their account will be saved to your notebook.</p>
        {:else}
          <p class="muted">Compare what you've heard. When a destination stands out, book your trip.</p>
          <div class="row-actions">
            {#if cooperationAvailable(app.coop.prefs) && app.coop.prefs?.enabled && app.game?.attempt_kind === "ordinary"}<AskForHelp {app} />{/if}
            <button class="btn" type="button" onclick={() => app.go("notebook")}><Icon name="notebook" />Notebook</button>
            <button class="btn" type="button" onclick={() => app.go("dossier")}><Icon name="id" />Dossier</button>
            <button class="btn btn-primary" type="button" onclick={() => app.go("travel")}><Icon name="plane" />Travel</button>
          </div>
        {/if}
      </section>
    </aside>
  </div>
</div>
