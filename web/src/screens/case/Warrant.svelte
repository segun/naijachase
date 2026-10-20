<script lang="ts">
  import "../../styles/warrant.css";
  import "../../styles/profile-list.css";
  import type { AppController } from "../../state/app.svelte";
  import { FIELDS, FIELD_META, dossierCount, duration, groupQuotes, quoteMinutes, raidQuote, venueInfo } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const ready = $derived(dossierCount(gs.dossier) === 8);
  const suspects = $derived(gs.suspect_files);
  let picked = $state<string | null>(null);
  let confirming = $state(false);
  // The final journey to a hideout is quoted by the server under the "apprehension" scope.
  const hideouts = $derived(groupQuotes(app.quotes, "apprehension"));
  const searched = $derived(new Set(gs.searched_hideouts ?? []));
  const suspectName = $derived(suspects.find(s => s.suspect_id === gs.warrant_suspect)?.name ?? gs.warrant_suspect);

  async function apply() {
    if (!picked) return;
    if (await app.command({ type: "request_warrant", suspect_id: picked }, "Warrant application processed.", "Filing warrant")) confirming = false;
  }
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Magistrate desk</p>
    <h1>Request a warrant</h1>
    <p>Match your dossier to the right suspect. The real thief will escape if you reach them with the wrong warrant.</p>
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
      {#each suspects as suspect, i (suspect.suspect_id)}
        <button type="button" class="suspect rise" class:picked={picked === suspect.suspect_id} disabled={!ready || app.busy} aria-pressed={picked === suspect.suspect_id} style:animation-delay="{i * 0.08}s" onclick={() => { picked = suspect.suspect_id; confirming = false; }}>
          <span class="suspect-photo" style:background={suspect.portrait.background_color} role="img" aria-label="Passport portrait of {suspect.name}">
            <svg viewBox="0 0 120 140" aria-hidden="true"><path fill={suspect.portrait.skin_color} d="M31 126c2-27 13-40 29-40s27 13 29 40z"/><ellipse fill={suspect.portrait.skin_color} cx="60" cy="58" rx="29" ry="35"/><path fill={suspect.portrait.hair_color} d="M31 58c0-29 12-43 30-43 22 0 31 18 28 46-8-11-18-16-30-16-10 0-19 4-28 13z"/><circle cx="49" cy="59" r="2.5"/><circle cx="71" cy="59" r="2.5"/><path d="M51 75q9 7 18 0" fill="none" stroke="#3a2018" stroke-width="2"/></svg>
          </span>
          <span class="file-no">File 0{i + 1}</span>
          <strong>{suspect.name}</strong>
          <span class="mono muted">{suspect.alias} · {suspect.suspect_id}</span>
          <span class="muted">{suspect.summary}</span>
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
      <h2>{suspectName}</h2>
      <p class="muted">{suspectName} is hiding at one of these places. Raid them one at a time until you find them.</p>
    </section>
    <section class="venues" aria-label="Search for the hideout">
      {#if !app.quotesLoaded}
        {#each [1, 2, 3] as n}<div class="venue skeleton-card" aria-hidden="true"></div>{/each}
      {:else if hideouts.length === 0}
        <p class="muted">No hideout can be reached right now. Check your funds and the clock.</p>
      {/if}
      {#each hideouts as venue, i (venue.id)}
        {@const info = venueInfo(venue.id)}
        {@const quote = raidQuote(venue.options)}
        {@const done = searched.has(venue.id)}
        <!-- No transport choice here: the raid drives if the player can afford it and otherwise hitches a ride (see raidQuote). -->
        <button type="button" class="venue rise" class:seen={done} disabled={app.busy || done || !quote} style:animation-delay="{i * 0.08}s" onclick={() => app.raid(venue)}>
          <span class="venue-icon"><Icon name={done ? "check" : info.icon} /></span>
          <span class="venue-body"><strong>{venue.label}</strong><span class="muted">{done ? "Raided. The suspect got away." : info.who}</span></span>
          <span class="venue-status">{#if done}Searched{:else if quote}Raid this location · {duration(quoteMinutes(quote))} <Icon name="arrow" />{:else}Out of reach{/if}</span>
        </button>
      {/each}
    </section>
  {/if}
</div>
