<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { FIELDS, FIELD_META, SUSPECTS, cheapest, dossierCount, duration, groupQuotes, money, venueInfo, type QuoteGroup, type TransportQuote } from "../model.ts";
  import Icon from "./Icon.svelte";
  import MoveDialog from "./MoveDialog.svelte";
  import MoveOptions from "./MoveOptions.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const ready = $derived(dossierCount(gs.dossier) === 8);
  let picked = $state<string | null>(null);
  let confirming = $state(false);
  // The final journey to a hideout is quoted by the server under the "apprehension" scope.
  const hideouts = $derived(groupQuotes(app.quotes, "apprehension"));
  let raiding = $state<QuoteGroup | null>(null);

  async function raid(group: QuoteGroup, quote: TransportQuote) {
    const ok = await app.command({ type: "search_hideout", venue_id: group.id, mode: quote.mode as "drive" | "hitch_ride" }, "Hideout searched.", "Searching hideout");
    if (ok) raiding = null;
  }

  async function apply() {
    if (!picked) return;
    if (await app.command({ type: "request_warrant", suspect_id: picked }, "Warrant application processed.", "Filing warrant")) confirming = false;
  }
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Magistrate desk</p>
    <h1>Request a warrant</h1>
    <p>Match your dossier to the right suspect. A wrong warrant costs time and score.</p>
  </header>

  <ol class="phases">
    <li class:done={ready} class:current={!ready}><span>1</span>Complete the dossier</li>
    <li class:done={!!gs.warrant_suspect} class:current={ready && !gs.warrant_suspect}><span>2</span>Choose a suspect</li>
    <li class:current={!!gs.warrant_suspect}><span>3</span>Find the hideout</li>
  </ol>

  {#if !gs.warrant_suspect}
    {#if !ready}
      <section class="card notice rise">
        <Icon name="lock" />
        <div><h2>Dossier incomplete</h2><p class="muted">{dossierCount(gs.dossier)} of 8 details recorded. Finish the profile before applying.</p></div>
        <button class="btn btn-primary" type="button" onclick={() => app.go("dossier")}>Open dossier <Icon name="arrow" /></button>
      </section>
    {/if}
    <section aria-label="Suspect files" class="suspects">
      {#each SUSPECTS as id, i}
        <button type="button" class="suspect rise" class:picked={picked === id} disabled={!ready || app.busy} aria-pressed={picked === id} style:animation-delay="{i * 0.08}s" onclick={() => { picked = id; confirming = false; }}>
          <span class="suspect-photo"><Icon name="user" /></span>
          <span class="file-no">File 0{i + 1}</span>
          <strong>Suspect {i + 1}</strong>
          <span class="mono muted">{id}</span>
        </button>
      {/each}
    </section>

    {#if ready}
      <section class="card compare rise">
        <h2>Your profile</h2>
        <dl class="profile-list wide">{#each FIELDS as f}<div><dt>{FIELD_META[f].label}</dt><dd>{gs.dossier[f]}</dd></div>{/each}</dl>
        {#if !confirming}
          <button class="btn btn-primary btn-lg" type="button" disabled={!picked || app.busy} onclick={() => (confirming = true)}>{picked ? `Apply for warrant · ${picked}` : "Select a suspect above"}</button>
        {:else}
          <div class="confirm" role="alertdialog" aria-labelledby="confirm-title">
            <h3 id="confirm-title">Submit warrant for {picked}?</h3>
            <p class="muted">Check your dossier once more before you submit.</p>
            <div class="row-actions">
              <button class="btn btn-primary" type="button" disabled={app.busy} onclick={apply}>{#if app.busy}<span class="spinner"></span>{/if}Yes, submit</button>
              <button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => (confirming = false)}>Cancel</button>
            </div>
          </div>
        {/if}
      </section>
    {/if}
  {:else}
    <section class="card issued rise">
      <div class="stamp-mark" role="img" aria-label="Warrant issued">Warrant issued</div>
      <h2>{gs.warrant_suspect}</h2>
      <p class="muted">The suspect is hiding somewhere nearby. Choose where to search.</p>
    </section>
    <section class="venues" aria-label="Search for the hideout">
      {#if !app.quotesLoaded}
        {#each [1, 2, 3] as n}<div class="venue skeleton-card" aria-hidden="true"></div>{/each}
      {:else if hideouts.length === 0}
        <p class="muted">No hideout can be reached right now. Check your funds and the clock.</p>
      {/if}
      {#each hideouts as venue, i (venue.id)}
        {@const info = venueInfo(venue.id)}
        {@const best = cheapest(venue.options.filter(o => o.affordable))}
        <button type="button" class="venue rise" disabled={app.busy} style:animation-delay="{i * 0.08}s" onclick={() => (raiding = venue)}>
          <span class="venue-icon"><Icon name={info.icon} /></span>
          <span class="venue-body"><strong>Search the {venue.label.toLowerCase()}</strong><span class="muted">{info.who}</span></span>
          <span class="venue-status">{#if best}{best.cost === 0 ? "Free" : money(best.cost)} · {duration(best.travel_minutes + best.wait_minutes)}{:else}Unaffordable{/if} <Icon name="arrow" /></span>
        </button>
      {/each}
    </section>
    {#if raiding}
      <MoveDialog title="Raid the {raiding.label.toLowerCase()}" subtitle="Choose how to get there. If the suspect is not here, the case may be lost." onclose={() => (raiding = null)}>
        <MoveOptions group={raiding} elapsed={gs.elapsed} balance={gs.balance} busy={app.busy} confirmLabel="Raid this hideout" working="Searching hideout" onconfirm={(q) => raid(raiding!, q)} oncancel={() => (raiding = null)} />
      </MoveDialog>
    {/if}
  {/if}
</div>
