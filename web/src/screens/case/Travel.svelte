<script lang="ts">
  import { tick } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { MAP_H, MAP_W, outlinePath, percentPoint, statePoint } from "../../domain/map.ts";
  import { STATES, ZONES, groupQuotes, money, type TransportQuote } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";
  import MoveOptions from "./MoveOptions.svelte";

  let { app }: { app: AppController } = $props();
  let selected = $state<string | null>(null);
  const gs = $derived(app.game!.state);
  const here = $derived(gs.current_state);
  // Which destinations exist, and what each journey costs, is entirely the server's call.
  const groups = $derived(groupQuotes(app.quotes, "interstate"));
  const quoted = $derived(new Map(groups.map(g => [g.id, g])));
  const reachable = (s: string) => quoted.has(s);
  const group = $derived(selected ? quoted.get(selected) ?? null : null);
  let view = $state<"map" | "list">("map");
  let query = $state("");
  let showInfo = $state(false);
  let sideEl = $state<HTMLElement | null>(null);

  $effect(() => {
    if (selected) tick().then(() => sideEl?.scrollIntoView({ behavior: "smooth", block: "end" }));
  });

  const trailPath = $derived(
    app.trail.map(s => statePoint(s)).filter(p => p !== null)
      .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(0)} ${p.y.toFixed(0)}`).join(" ")
  );
  const filtered = $derived(
    Object.entries(ZONES)
      .map(([zone, members]) => [zone, members.filter(s => s.toLowerCase().includes(query.trim().toLowerCase()))] as const)
      .filter(([, members]) => members.length > 0)
  );

  async function go(quote: TransportQuote) {
    if (!selected || !quote.affordable || (gs.balance === 0 && quote.cost > 0)) return;
    const destination = selected, origin = here;
    if (await app.command({ type: "travel", destination, mode: quote.mode }, `Arrived in ${destination}.`, `Travelling to ${destination}`)) {
      selected = null;
      app.startJourney(origin, destination, quote.mode);
    }
  }
</script>

{#snippet viewToggle()}
<div class="segmented view-toggle" role="group" aria-label="Destination view">
      <button type="button" aria-pressed={view === "map"} onclick={() => (view = "map")}><Icon name="map" />Map</button>
      <button type="button" aria-pressed={view === "list"} onclick={() => (view = "list")}><Icon name="list" />List</button>
    </div>
{/snippet}

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Air and road desk</p>
    <h1>Choose your destination</h1>
  </header>

  <div class="segmented" role="group" aria-label="Destination view">
    <button type="button" aria-pressed={view === "map"} onclick={() => (view = "map")}><Icon name="map" />Map</button>
    <button type="button" aria-pressed={view === "list"} onclick={() => (view = "list")}><Icon name="list" />List</button>
  </div>

  <div class="split travel">
    <section class="card map-card rise" aria-label="Destinations">
      {#if view === "map"}
        <div class="map" style:aspect-ratio="{MAP_W} / {MAP_H}">
          <button type="button" class="map-info" aria-label="About this map" aria-expanded={showInfo} onclick={() => (showInfo = !showInfo)}><Icon name="info" /></button>
          {#if showInfo}
            <div class="map-info-pop" role="dialog" aria-label="Travel advice">
              <p>Use the witness clues. A wrong state costs time, money and score, so check the fare and confirm before you travel. Funds: <strong>{money(gs.balance)}</strong>.</p>
              <button class="btn btn-ghost" type="button" onclick={() => (showInfo = false)}>Got it</button>
            </div>
          {/if}
          <svg viewBox="0 0 {MAP_W} {MAP_H}" aria-hidden="true">
            <path d={outlinePath()} class="land" />
            {#if trailPath}<path d={trailPath} class="trail-line" />{/if}
            {#if selected}{@const a = statePoint(here)}{@const b = statePoint(selected)}{#if a && b}<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="plan-line" />{/if}{/if}
          </svg>
          {#each STATES as s}
            {@const p = percentPoint(s)}
            {#if p}
              <button
                type="button" class="node" class:current={s === here} class:visited={app.trail.includes(s) && s !== here} class:selected={s === selected}
                style:left={p.left} style:top={p.top} disabled={s === here || app.busy || (app.quotesLoaded && !reachable(s))} aria-pressed={s === selected}
                aria-label={s === here ? `${s}, current location` : s} onclick={() => (selected = s)}
              ><span class="node-label">{s === "Federal Capital Territory" ? "FCT" : s}</span></button>
            {/if}
          {/each}
        </div>
        <div class="toggle-end">{@render viewToggle()}
  </div>
      {:else}
        {@render viewToggle()}
        <label class="field"><span>Search states</span><input class="input" type="search" bind:value={query} placeholder="Type a state…" /></label>
        <div class="zones">
          {#each filtered as [zone, members]}
            <section>
              <h3>{zone}</h3>
              <ul>
                {#each members as s}
                  <li><button type="button" class="state-row" class:selected={s === selected} disabled={s === here || app.busy || (app.quotesLoaded && !reachable(s))} aria-pressed={s === selected} onclick={() => (selected = s)}>
                    <span>{s}</span>{#if s === here}<span class="badge badge-gold">Here</span>{:else if app.trail.includes(s)}<span class="badge">Visited</span>{/if}
                  </button></li>
                {/each}
              </ul>
            </section>
          {:else}<p class="muted">No state matches “{query}”.</p>{/each}
        </div>
      {/if}
    </section>

    <aside class="stack side-rail">
      <section class="card boarding rise" aria-live="polite" bind:this={sideEl}>
        <p class="eyebrow">Boarding pass</p>
        <div class="route"><div><small>From</small><strong>{here}</strong></div><Icon name="plane" /><div><small>To</small><strong>{selected ?? "—"}</strong></div></div>
        {#if selected && group}
          {#key selected}
            <MoveOptions {group} elapsed={gs.elapsed} balance={gs.balance} busy={app.busy} confirmLabel={`Travel to ${selected}`} working={app.busyLabel || "Travelling"} onconfirm={go} summary={false}>
            {#snippet actions()}<button class="btn btn-ghost btn-icon" type="button" aria-label="Clear selection" title="Clear selection" disabled={app.busy} onclick={() => (selected = null)}><Icon name="x" /></button>{/snippet}
            </MoveOptions>
          {/key}
        {:else if selected}
          <p class="muted">{app.quotesLoaded ? "No journey to this destination is available right now." : "Fetching fares…"}</p>
        {:else}
          <p class="muted">Select a destination on the map or in the list.</p>
        {/if}
      </section>
      <section class="card">
        <h2>Journey so far</h2>
        <ol class="trail">{#each app.trail as stop, i}<li class:current={i === app.trail.length - 1}><span class="dot"></span>{stop}</li>{/each}</ol>
      </section>
    </aside>
  </div>
</div>
