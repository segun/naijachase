<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { FIELDS, FIELD_META, SUSPECTS, VENUES, dossierCount } from "../model.ts";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const ready = $derived(dossierCount(gs.dossier) === 8);
  let picked = $state<string | null>(null);
  let confirming = $state(false);

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
      {#each VENUES as venue, i}
        <button type="button" class="venue rise" disabled={app.busy} style:animation-delay="{i * 0.08}s" onclick={() => app.command({ type: "search_hideout", venue_id: venue.id }, "Hideout searched.", "Searching hideout")}>
          <span class="venue-icon"><Icon name={venue.icon} /></span>
          <span class="venue-body"><strong>Search the {venue.name.toLowerCase()}</strong><span class="muted">{venue.who}</span></span>
          <span class="venue-status">Raid <Icon name="arrow" /></span>
        </button>
      {/each}
    </section>
  {/if}
</div>
