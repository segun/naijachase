<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { MAP_H, MAP_W, outlinePath, percentPoint, statePoint } from "../map.ts";
  import { STATES, ZONES, groupQuotes, money, zoneOf, type TransportQuote } from "../model.ts";
  import Icon from "./Icon.svelte";
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
    if (!selected) return;
    const destination = selected;
    if (await app.command({ type: "travel", destination, mode: quote.mode }, `Arrived in ${destination}.`, `Travelling to ${destination}`)) {
      selected = null;
      app.go("investigate");
    }
  }
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Air and road desk</p>
    <h1>Choose your destination</h1>
    <p>Use the witness clues. A wrong state costs time, money and score, so check the fare and confirm before you travel. Funds: <strong>{money(gs.balance)}</strong>.</p>
  </header>

  <div class="segmented" role="group" aria-label="Destination view">
    <button type="button" aria-pressed={view === "map"} onclick={() => (view = "map")}><Icon name="map" />Map</button>
    <button type="button" aria-pressed={view === "list"} onclick={() => (view = "list")}><Icon name="list" />List</button>
  </div>

  <div class="split travel">
    <section class="card map-card rise" aria-label="Destinations">
      {#if view === "map"}
        <div class="map" style:aspect-ratio="{MAP_W} / {MAP_H}">
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
        <p class="map-note muted">Schematic map. Dots mark each state's capital. Prefer text? Switch to List.</p>
      {:else}
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
      <section class="card boarding rise" aria-live="polite">
        <p class="eyebrow">Boarding pass</p>
        <div class="route"><div><small>From</small><strong>{here}</strong></div><Icon name="plane" /><div><small>To</small><strong>{selected ?? "—"}</strong></div></div>
        {#if selected && group}
          <p class="muted">{zoneOf(selected) ?? "Nigeria"}. Fares and journey times are quoted by the service.</p>
          {#key selected}
            <MoveOptions {group} elapsed={gs.elapsed} balance={gs.balance} busy={app.busy} confirmLabel={`Travel to ${selected}`} working={app.busyLabel || "Travelling"} onconfirm={go} />
          {/key}
          <button class="btn btn-ghost btn-block" type="button" disabled={app.busy} onclick={() => (selected = null)}>Clear selection</button>
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
