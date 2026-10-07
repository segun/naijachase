<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { TOTAL_STOPS, VENUES, clockParts, dayPart, dossierCount, questionedHere, zoneOf } from "../model.ts";
  import Icon from "./Icon.svelte";
  import Stepper from "./Stepper.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const done = $derived(questionedHere(gs));
  const here = $derived(app.notes.filter(n => n.stop === gs.current_state).slice(-3));
  const part = $derived(dayPart(clockParts(gs.elapsed).hour));
  const pendingVenue = $state({ id: "" });
  const venueIcon = (name: string) => VENUES.find(v => v.name === name)?.icon ?? "chat";

  async function question(id: string) {
    pendingVenue.id = id;
    await app.command({ type: "visit_venue", venue_id: id }, "Witness interviewed.", "Interviewing witness");
    pendingVenue.id = "";
  }
</script>

<div class="page investigate">
  {#key gs.current_state}
    <section class="scene-banner rise">
      <div>
        <p class="eyebrow">Stop {Math.min(gs.stage + 1, TOTAL_STOPS)} of {TOTAL_STOPS} · {part}</p>
        <h1>{gs.current_state}</h1>
        <p class="muted">{zoneOf(gs.current_state) ?? "Nigeria"} · {done.length} of {VENUES.length} witnesses questioned</p>
      </div>
      <Stepper stage={gs.stage} />
    </section>
  {/key}

  <div class="split">
    <section aria-labelledby="leads-title" class="stack">
      <h2 id="leads-title">Local leads</h2>
      <p class="muted">Listen for a destination clue and a detail about the suspect. One witness here knows where the thief went next.</p>
      <div class="venues">
        {#each VENUES as venue, i}
          {@const seen = done.includes(venue.id)}
          {@const working = app.busy && pendingVenue.id === venue.id}
          <button class="venue rise" class:seen type="button" disabled={app.busy || seen} style:animation-delay="{i * 0.08}s" onclick={() => question(venue.id)}>
            <span class="venue-icon"><Icon name={venue.icon} /></span>
            <span class="venue-body">
              <strong>{venue.name}</strong>
              <span class="muted">{venue.who}</span>
              <span class="venue-blurb">{venue.blurb}</span>
            </span>
            <span class="venue-status">
              {#if working}<span class="spinner"></span> Questioning
              {:else if seen}<Icon name="check" /> Questioned
              {:else}Question <Icon name="arrow" />{/if}
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
          <div><dt>Dossier</dt><dd>{dossierCount(gs.dossier)}/8</dd></div>
          <div><dt>Notes</dt><dd>{app.notes.length}</dd></div>
          <div><dt>Mission</dt><dd class="mono">{gs.mission_id}</dd></div>
        </dl>
      </section>
      <section class="card next-step">
        <h2>Next move</h2>
        {#if done.length === 0}
          <p class="muted">Start by questioning someone. Their account will be saved to your notebook.</p>
        {:else}
          <p class="muted">Compare what you've heard. When a destination stands out, book your trip.</p>
          <div class="row-actions">
            <button class="btn" type="button" onclick={() => app.go("notebook")}><Icon name="notebook" />Notebook</button>
            <button class="btn" type="button" onclick={() => app.go("dossier")}><Icon name="id" />Dossier</button>
            <button class="btn btn-primary" type="button" onclick={() => app.go("travel")}><Icon name="plane" />Travel</button>
          </div>
        {/if}
      </section>
    </aside>
  </div>
</div>
