<script lang="ts">
  import { untrack } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { KNOWN_VENUES, MODE_LABEL, STATES, clockParts, dossierCount, money, secondsLabel, venueInfo, weeklyStatus, type InterstateMode, type LocalMode } from "../../domain/model.ts";
  import DossierOptionsStatus from "../../ui/DossierOptionsStatus.svelte";
  import Icon from "../../ui/Icon.svelte";
  import { journeyModeOf } from "../../scenes/journey/journey-scene.ts";

  let { app }: { app: AppController } = $props();
  const g = $derived(app.groups);
  const a = $derived(g.attempt!);
  const s = $derived(a.state);
  const status = $derived(weeklyStatus(a.status));
  const inTransit = $derived(a.status === "in_transit" && a.transit);
  const over = $derived(a.status === "solved" || a.status === "closed" || a.status === "expired" || a.status === "forfeited" || !!s.outcome);
  const clock = $derived(clockParts(s.elapsed));
  let tab = $state<"question" | "travel" | "dossier" | "warrant">("question");
  let venue = $state(KNOWN_VENUES[0] ?? "market"), localMode = $state<LocalMode>("drive");
  let destination = $state(""), interMode = $state<InterstateMode>("drive");
  let suspect = $state<string>("");
  const suspectFiles = $derived(s.suspect_files ?? []);
  let values = $state<Record<string, string>>(untrack(() => ({ ...app.groups.attempt!.state.dossier })));
  let startedAt = $state(0);
  // The "show travel route" view: an endless animation of the journey. It never speeds up or ends the real wait; Esc returns to the text.
  let route = $state<{ from: string; to: string; mode: "drive" | "hitch" | "fly"; seed: number } | null>(null);
  const routeMode = $derived(a.transit ? journeyModeOf(a.transit.mode) : null);
  const lazyScene = () => import("../../scenes/journey/JourneyScene.svelte");
  function showRoute() {
    if (!a.transit || !routeMode) return;
    route = { from: s.current_state, to: a.transit.destination, mode: routeMode, seed: Math.floor(Math.random() * 2147483000) };
  }

  // Remember the longest wait seen for this journey so the bar can fill as the server's remaining time falls.
  $effect(() => { const r = a.transit?.remaining_seconds ?? 0; if (r > startedAt || !a.transit) startedAt = a.transit ? r : 0; });
  const progress = $derived(startedAt > 0 && a.transit ? Math.round((1 - a.transit.remaining_seconds / startedAt) * 100) : 0);
  const options = $derived(STATES.filter(x => x !== s.current_state));
  $effect(() => { if (!destination || destination === s.current_state) destination = options[0] ?? ""; });
  $effect(() => { if (!suspectFiles.some(file => file.suspect_id === suspect)) suspect = suspectFiles[0]?.suspect_id ?? ""; });

  const locals: LocalMode[] = ["drive", "hitch_ride"], inters: InterstateMode[] = ["fly", "drive", "hitch_ride"];
  const paidModeDisabled = (mode: InterstateMode | LocalMode) => s.balance === 0 && mode !== "hitch_ride";
  $effect(() => {
    if (s.balance === 0) {
      localMode = "hitch_ride";
      interMode = "hitch_ride";
    }
  });
  async function saveField(field: string) {
    const value = values[field] ?? "";
    if (!value || value === s.dossier[field]) return;
    await g.command({ type: "record_trait", trait_name: field, value }, "Dossier updated.", "Filing dossier");
  }
</script>

<section class="card rise weekly-play" aria-labelledby="play-title">
  <div class="row-between"><h2 id="play-title">Your attempt</h2><span class="badge badge-{status.tone === 'muted' ? '' : status.tone}">{status.label}</span></div>
  <dl class="facts">
    <div><dt>Location</dt><dd>{s.current_state}</dd></div>
    <div><dt>Trail</dt><dd class:urgent-text={s.trail_status === "cold"}>{s.trail_status === "hot" ? "Trail hot" : "Trail cold"}</dd></div>
    <div><dt>Case clock</dt><dd>{clock.day} {clock.time}</dd></div>
    <div><dt>Challenge funds</dt><dd>{money(s.balance)}</dd></div>
    <div><dt>Dossier</dt><dd>{dossierCount(s.dossier)}/8</dd></div>
  </dl>

  {#if inTransit && a.transit}
    <div class="transit" role="status" aria-live="polite">
      <Icon name="plane" />
      <div>
        <strong>On the way to {a.transit.destination}</strong>
        <small class="muted">{MODE_LABEL[a.transit.mode]} · arriving in {secondsLabel(a.transit.remaining_seconds)}. No commands are accepted until you arrive; animations never speed this up.</small>
        <div class="meter"><span style:width="{progress}%"></span></div>
        {#if routeMode}<button class="btn" type="button" onclick={showRoute}>Show travel route</button>{/if}
      </div>
    </div>
  {:else if over}
    <p class="badge badge-{a.winner ? 'gold' : ''}" role="status">{a.winner ? "You won the challenge!" : a.status === "solved" ? "You caught the thief." : "Your attempt has ended."}</p>
  {:else}
    <div class="segmented" role="group" aria-label="Actions">
      {#each [["question", "Question"], ["travel", "Travel"], ["dossier", "Dossier"], ["warrant", "Warrant"]] as [id, label]}
        <button type="button" aria-pressed={tab === id} onclick={() => (tab = id as typeof tab)}>{label}</button>
      {/each}
    </div>

    {#if tab === "question"}
      <form class="form" onsubmit={(e) => { e.preventDefault(); void g.command({ type: "visit_venue", venue_id: venue, mode: localMode }, "Witness interviewed.", "Interviewing witness"); }}>
        <label class="field"><span>Witness</span><select class="select" bind:value={venue}>{#each KNOWN_VENUES as v}<option value={v}>{v.replaceAll("_", " ")} · {venueInfo(v).who}</option>{/each}</select></label>
        <fieldset class="mode-pick"><legend>How will you get there?</legend>{#each locals as m}<label class="check"><input type="radio" bind:group={localMode} value={m} disabled={paidModeDisabled(m)} /> {MODE_LABEL[m]}</label>{/each}</fieldset>
        {#if s.balance === 0}<small class="hint warn">Your challenge funds are exhausted. Only Hitch a ride is available.</small>{/if}
        <button class="btn btn-primary" disabled={app.busy}>Go and question witnesses</button>
      </form>
    {:else if tab === "travel"}
      <form class="form" onsubmit={(e) => { e.preventDefault(); void g.command({ type: "travel", destination, mode: interMode }, "Journey started.", "Booking journey"); }}>
        <label class="field"><span>Destination</span><select class="select" bind:value={destination}>{#each options as x}<option>{x}</option>{/each}</select></label>
        <fieldset class="mode-pick"><legend>Mode</legend>{#each inters as m}<label class="check"><input type="radio" bind:group={interMode} value={m} disabled={paidModeDisabled(m)} /> {MODE_LABEL[m]}</label>{/each}</fieldset>
        {#if s.balance === 0}<small class="hint warn">Your challenge funds are exhausted. Fly and Drive are unavailable; Hitch a ride remains free.</small>{/if}
        <button class="btn btn-primary" disabled={app.busy || !destination}>Travel</button>
      </form>
    {:else if tab === "dossier"}
      <DossierOptionsStatus {app} />
      <div class="dossier-grid">
        {#each app.dossierOptions?.fields ?? [] as entry}
          {@const recordedValue = s.dossier[entry.field]}
          <label class="field">
            <span>{entry.label}</span>
            <select class="select" name={entry.field} bind:value={values[entry.field]} onchange={() => saveField(entry.field)} disabled={app.busy}>
              <option value="">Not yet known</option>
              {#each entry.options as option}<option value={option}>{option}</option>{/each}
            </select>
            {#if recordedValue && !entry.options.includes(recordedValue)}<small class="hint warn">Previously recorded: {recordedValue}. Choose a listed value to replace it.</small>{/if}
          </label>
        {/each}
      </div>
    {:else}
      {#if !s.warrant_suspect}
        <form class="form" onsubmit={(e) => { e.preventDefault(); void g.command({ type: "request_warrant", suspect_id: suspect }, "Warrant processed.", "Filing warrant"); }}>
          <label class="field"><span>Suspect file</span><select class="select" bind:value={suspect}>{#each suspectFiles as file}<option value={file.suspect_id}>{file.name} · {file.alias}</option>{/each}</select></label>
          {#each suspectFiles as file}<article class="card"><strong>{file.name}</strong><p>{file.summary}</p></article>{/each}
          <button class="btn btn-primary" disabled={app.busy || dossierCount(s.dossier) < 8}>Request warrant</button>
          {#if dossierCount(s.dossier) < 8}<small class="hint warn">Complete all eight dossier details first.</small>{/if}
        </form>
      {:else}
        <form class="form" onsubmit={(e) => { e.preventDefault(); void g.command({ type: "search_hideout", venue_id: venue, mode: localMode }, "Hideout searched.", "Searching hideout"); }}>
          <p class="badge badge-gold">Warrant issued · {s.warrant_suspect}</p>
          <label class="field"><span>Hideout to search</span><select class="select" bind:value={venue}>{#each KNOWN_VENUES as v}<option value={v}>{v.replaceAll("_", " ")}</option>{/each}</select></label>
          <fieldset class="mode-pick"><legend>How will you get there?</legend>{#each locals as m}<label class="check"><input type="radio" bind:group={localMode} value={m} disabled={paidModeDisabled(m)} /> {MODE_LABEL[m]}</label>{/each}</fieldset>
          {#if s.balance === 0}<small class="hint warn">Your challenge funds are exhausted. Only Hitch a ride is available.</small>{/if}
          <button class="btn btn-primary" disabled={app.busy}>Raid this hideout</button>
        </form>
      {/if}
    {/if}
  {/if}
</section>

{#if route}
  {#await lazyScene() then { default: Scene }}
    <Scene {app} visit={route} loop startHour={clock.hour} note={inTransit ? undefined : `You have arrived in ${route.to}. Press Esc to go back.`} onclose={() => (route = null)} />
  {/await}
{/if}
