<script lang="ts">
  // The case on the office computer. While a case is open the agency terminal shows the case itself: where the player is, the case clock,
  // funds and score, the local leads to visit, and the notebook, the dossier, travel and the warrant desk. There is no "start a new case"
  // here. Choosing a lead stands the player up and sends them to the garage; coming back from a venue lands them here again.
  import { onMount } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import {
    TOTAL_STOPS, clockParts, opensAt, coopActions, countdown, secondsLabel, cooperationAvailable, dayPart, dossierCount, groupQuotes, money, questionedHere, timeLeft, zoneOf, type QuoteGroup, type Screen
  } from "../../domain/model.ts";
  import AskForHelp from "../../screens/case/AskForHelp.svelte";
  import Dossier from "../../screens/case/Dossier.svelte";
  import Notebook from "../../screens/case/Notebook.svelte";
  import Pressure from "../../screens/case/Pressure.svelte";
  import Travel from "../../screens/case/Travel.svelte";
  import Warrant from "../../screens/case/Warrant.svelte";
  import HireAssistant from "../../screens/case/HireAssistant.svelte";
  import Icon from "../../ui/Icon.svelte";
  import LeadGrid from "./LeadGrid.svelte";
  import "../../styles/case-terminal.css";

  let { app, awake = true, leave = async () => {} }: { app: AppController; awake?: boolean; leave?: () => Promise<void> } = $props();

  const gs = $derived(app.game!.state);
  let tick = $state(Date.now());
  // A weekly case runs on the real clock, so it keeps moving while the player reads; an ordinary case only moves when they act.
  const elapsed = $derived(app.isWeekly && gs.outcome === null ? gs.elapsed + Math.max(0, Math.floor((tick - app.weeklyFetchedAt) / 60000)) : gs.elapsed);
  const parts = $derived(clockParts(elapsed));
  const left = $derived(timeLeft(elapsed));
  const night = $derived(dayPart(parts.hour) === "night");
  const done = $derived(questionedHere(gs));
  const here = $derived(app.notes.filter(n => n.stop === gs.current_state).slice(-3));
  const waiting = $derived(app.coop.requests.filter(r => coopActions(r, app.player?.username ?? "").length).length);

  let menuOpen = $state(false);
  let abandonOpen = $state(false);
  let abandonDialog = $state<HTMLDialogElement>();
  let leaving = $state("");
  let now = $state(new Date());
  const weekly = $derived(app.isWeekly);
  const transit = $derived(app.weeklyTransit);
  const remaining = $derived(transit ? Math.max(0, Math.round((transit.arrivesAt - tick) / 1000)) : 0);
  const closes = $derived(weekly ? countdown(app.weeklyEnds, tick) : null);
  let root = $state<HTMLElement>();
  const day = $derived(now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }));
  const clock = $derived(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

  // Venues come from the server's local quotes; one already questioned here may no longer be quoted.
  const venues = $derived.by(() => {
    const quoted = groupQuotes(app.quotes, "local");
    const ids = new Set(quoted.map(g => g.id));
    return [...quoted, ...done.filter(id => !ids.has(id)).map((id): QuoteGroup => ({ id, label: id.replaceAll("_", " "), options: [] }))];
  });

  type Item = { screen: Screen; label: string; icon: string; key: string; count?: string };
  const items = $derived<Item[]>([
    { screen: "investigate", label: "Local leads", icon: "search", key: "L", count: `${done.length}/${venues.length || "…"}` },
    { screen: "notebook", label: "Notebook", icon: "notebook", key: "B", count: String(app.notes.length) },
    { screen: "dossier", label: "Dossier", icon: "id", key: "D", count: `${dossierCount(gs.dossier)}/8` },
    { screen: "travel", label: "Travel", icon: "plane", key: "T" },
    { screen: "warrant", label: "Warrant", icon: "warrant", key: "W" }
  ]);
  const weeklyMenu: { screen: Screen; label: string; icon: string; count?: () => number }[] = [
    { screen: "weekly", label: "Weekly lobby", icon: "trophy" },
    { screen: "cases", label: "Ordinary cases", icon: "home" },
    { screen: "settings", label: "Settings", icon: "sliders" }
  ];
  const ordinaryMenu: { screen: Screen; label: string; icon: string; count?: () => number }[] = [
    { screen: "archive", label: "Case archive", icon: "archive", count: () => app.archive.length },
    { screen: "groups", label: "Groups", icon: "users", count: () => app.groups.invitations.length },
    { screen: "weekly", label: "Weekly", icon: "trophy" },
    { screen: "helpers", label: "Helpers", icon: "helper", count: () => waiting },
    { screen: "tokens", label: "Bribe tokens", icon: "star", count: () => app.tokenBalance ?? 0 },
    { screen: "settings", label: "Settings", icon: "sliders" }
  ];
  const menu = $derived(weekly ? weeklyMenu : ordinaryMenu);
  const title = $derived(items.find(i => i.screen === app.screen)?.label ?? "Case");

  $effect(() => {
    const dialog = abandonDialog;
    if (!abandonOpen || !dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); opener?.focus?.(); };
  });

  onMount(() => {
    const timer = setInterval(() => { now = new Date(); }, 20000);
    const second = setInterval(() => { tick = Date.now(); }, 1000);
    return () => { clearInterval(timer); clearInterval(second); };
  });

  // Hand keyboard focus to the first action once the screen wakes, and again whenever the panel changes.
  let focused = "";
  $effect(() => {
    const screen = app.screen;
    if (!awake || !root || focused === screen) return;
    focused = screen;
    queueMicrotask(() => root?.querySelector<HTMLElement>("[data-primary], .t-embed input, .t-embed button")?.focus({ preventScroll: true }));
  });

  function open(screen: Screen) {
    menuOpen = false;
    if (!leaving) app.go(screen);
  }

  async function pick(lead: QuoteGroup) {
    if (leaving || transit) return;
    leaving = lead.id;
    await leave();
    app.finishBriefing(lead.id);
  }

  function keys(e: KeyboardEvent) {
    if (!awake || leaving || e.metaKey || e.ctrlKey || e.altKey) return;
    // A fare dialog (travel, ask for help) owns the keyboard while it is open: Escape closes it and nothing else.
    if (document.querySelector("dialog[open]")) return;
    // Typing into a form (the dossier) must never trigger a shortcut.
    const target = e.target as HTMLElement | null;
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
    const k = e.key.toLowerCase();
    const hit = items.find(i => i.key.toLowerCase() === k);
    if (k === "escape") { if (menuOpen) menuOpen = false; else if (app.screen !== "investigate") app.go("investigate"); else return; }
    else if (hit) app.go(hit.screen);
    else if (k === "m") menuOpen = !menuOpen;
    else if (k === "arrowdown" || k === "arrowup") {
      const list = [...(root?.querySelectorAll<HTMLElement>(".t-side [data-nav]:not([disabled]), .t-leads [data-nav]:not([disabled])") ?? [])];
      if (!list.length) return;
      const at = list.indexOf(document.activeElement as HTMLElement);
      list[(at + (k === "arrowdown" ? 1 : -1) + list.length) % list.length]!.focus();
    } else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={keys} />

{#snippet travelling()}
  {#if transit}
    <section class="t-transit" role="status" aria-live="polite">
      <strong><Icon name="plane" /> On the way</strong>
      <p class="t-line">Heading for {app.weeklyPlace(transit.destination)}. Arriving in {secondsLabel(remaining)}. The journey takes its real time; nothing you watch speeds it up, and no commands are accepted until you arrive. Your notebook stays open.</p>
      <button class="t-opt t-hot" type="button" data-nav data-primary onclick={() => app.watchWeeklyTransit()}><Icon name="arrow" /><span class="t-label">Watch the journey</span></button>
    </section>
  {/if}
{/snippet}

<div class="crt-screen" class:on={awake} bind:this={root} aria-label="Agency terminal: case" role="region">
  <div class="t-content t-case-content">
    <div class="t-top">
      <header class="t-bar">
        <span class="t-title"><Icon name="pin" /> NAIJA CHASE <small>// {weekly ? "WEEKLY CHALLENGE" : app.isReplay ? "REPLAY · NO POINTS" : "CASE FILE"}</small>{#if weekly}<span class="t-weekly-tag">First catch wins</span>{/if}</span>
        <span class="t-clock" aria-label="Local time">{day} · {clock}</span>
      </header>
      <section class="t-case" aria-label="Case status">
        <div class="t-stat"><span class="t-tag">Location</span><strong>{gs.current_state}</strong><small>{zoneOf(gs.current_state) ?? "Nigeria"} · stop {Math.min(gs.stage + 1, TOTAL_STOPS)} of {TOTAL_STOPS} · trail {gs.trail_status}</small><span class="t-trail" class:cold={gs.trail_status === "cold"}><Icon name={gs.trail_status === "hot" ? "flame" : "snow"} /> Trail {gs.trail_status === "hot" ? "hot" : "cold"}</span></div>
        {#if transit}<div class="t-stat"><span class="t-tag">Journey</span><strong>{secondsLabel(remaining)}</strong><small>to {app.weeklyPlace(transit.destination)}</small></div>{/if}
        <div class="t-stat"><span class="t-tag">Case clock</span><strong><Icon name={night ? "moon" : "sun"} /> {parts.day} {parts.time}</strong><small class:urgent={left.urgent}>{left.label}</small></div>
      </section>
    </div>

    <div class="t-body">
      <nav class="t-side" aria-label="Case tools">
        <ul class="t-list">
          {#each items as item}
            <li>
              <button class="t-opt" class:active={app.screen === item.screen} type="button" data-nav aria-current={app.screen === item.screen ? "page" : undefined} disabled={Boolean(leaving)} onclick={() => open(item.screen)}>
                <Icon name={item.icon} /><span class="t-label">{item.label}</span>{#if item.count}<span class="t-count">{item.count}</span>{/if}<kbd>{item.key}</kbd>
              </button>
            </li>
          {/each}
        </ul>
        <button class="t-opt t-menu" type="button" data-nav aria-expanded={menuOpen} aria-controls="t-menu-list" onclick={() => (menuOpen = !menuOpen)}>
          <span class="t-glyph" aria-hidden="true">{menuOpen ? "▾" : "▸"}</span><span class="t-label">Menu</span><kbd>M</kbd>
        </button>
        {#if menuOpen}
          <ul id="t-menu-list" class="t-list">
            {#each menu as item}
              {@const n = item.count?.() ?? 0}
              <li><button class="t-opt" type="button" data-nav onclick={() => open(item.screen)}><Icon name={item.icon} /><span class="t-label">{item.label}</span>{#if n}<span class="t-count">{n}</span>{/if}</button></li>
            {/each}
            {#if app.game?.attempt_kind === "ordinary" && app.game.state.outcome === null}
              <li><button class="t-opt t-danger" type="button" data-nav disabled={app.busy || Boolean(leaving)} onclick={() => (abandonOpen = true)}><Icon name="logout" /><span class="t-label">Abandon case</span></button></li>
            {/if}
            <li><button class="t-opt t-danger" type="button" data-nav disabled={app.busy} onclick={() => app.logout()}><Icon name="logout" /><span class="t-label">Log out</span></button></li>
          </ul>
        {/if}
      </nav>

      <main class="t-main" id="terminal-main" aria-label={title}>
        {#if app.screen === "investigate"}
          <section class="t-leads" aria-labelledby="leads-title">
            <h1 class="t-greet" id="leads-title">Local leads {#if !weekly}<HireAssistant {app} />{/if}</h1>
            <p class="t-line">{gs.current_state}: {done.length} of {venues.length || "…"} witnesses questioned. {gs.trail_status === "hot" ? "The trail is hot. Listen for a destination clue and a detail about the suspect; one witness here knows where the thief went next." : "The trail is cold. Local witnesses may confirm that the suspect did not come this way."}</p>
            {#if transit}{@render travelling()}{:else}
            <LeadGrid leads={venues} closedUntil={app.isWeekly ? q => opensAt(app.game?.state.elapsed ?? 0, q) : undefined} loaded={app.quotesLoaded} {leaving} questioned={done} onpick={pick} />
            {/if}

            {#if gs.assistant_hired}
              <p class="t-line t-hint">Your assistant is working on this case.</p>
            {/if}

            {#if here.length}
              <section class="t-log" aria-label="Latest witness accounts">
                <h2>What you heard</h2>
                {#each here as note}
                  <p><span class="t-who">{note.venue}</span> {note.message}</p>
                {/each}
              </section>
            {/if}

            {#if !weekly}<Pressure {app} {venues} questioned={done} />{/if}

            {#if cooperationAvailable(app.coop.prefs) && app.coop.prefs?.enabled && app.game?.attempt_kind === "ordinary"}
              <div class="t-embed t-inline"><AskForHelp {app} /></div>
            {/if}
            <p class="t-line t-hint">{done.length === 0 ? "Start by questioning someone. Their account is saved to your notebook." : "Compare what you've heard. When a destination stands out, open Travel."}</p>
          </section>
        {:else}
          <div class="t-embed">
            {#if app.screen === "notebook"}<Notebook {app} />
            {:else if transit}{@render travelling()}
            {:else if app.screen === "dossier"}<Dossier {app} />
            {:else if app.screen === "travel"}<Travel {app} />
            {:else if app.screen === "warrant"}<Warrant {app} />{/if}
          </div>
        {/if}
      </main>
    </div>

    <footer class="t-status" aria-label="Case figures">
      {#if closes}<span class="t-fig"><span class="t-tag">Challenge closes</span> <strong class:urgent={closes.urgent}>{closes.label.replace(" left", "")}</strong></span>
      {:else}<span class="t-fig"><span class="t-tag">Deadline Monday 07:00</span> <strong class:urgent={left.urgent}>{left.percentUsed}% used</strong></span>{/if}
      <span class="t-fig"><span class="t-tag">Funds</span> <strong>{money(gs.balance)}</strong></span>
      <span class="t-fig"><span class="t-tag">Score</span> <strong>{gs.score.toLocaleString()}</strong></span>
      {#if !weekly}<span class="t-fig"><span class="t-tag">Bribe tokens</span> <strong aria-label="{app.tokenBalance ?? 'unknown'} earned bribe tokens">{app.tokenBalance ?? "…"}</strong></span>{/if}
      <span class="t-blink" aria-hidden="true">● online</span>
    </footer>
  </div>
  <div class="crt-fx" aria-hidden="true"></div>
</div>

{#if abandonOpen}
  <dialog class="move-dialog card" bind:this={abandonDialog} aria-labelledby="abandon-case-title" aria-describedby="abandon-case-description" oncancel={e => { if (app.busy) e.preventDefault(); }} onclose={() => (abandonOpen = false)} onclick={e => { if (!app.busy && e.target === abandonDialog) abandonOpen = false; }}>
    <div class="move-dialog-body">
      <h2 id="abandon-case-title">Abandon this case?</h2>
      <p id="abandon-case-description" class="muted">Your investigation progress, evidence, remaining case budget, score, and any uncommitted rank progress from this case will be lost. Disciplinary penalties and spent tokens will not be restored. This cannot be undone.</p>
      <div class="row-actions">
        <button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => (abandonOpen = false)}>Keep investigating</button>
        <button class="btn btn-danger" type="button" disabled={app.busy} onclick={async () => { await app.abandonCurrentCase(); abandonOpen = false; }}>{app.busy ? "Abandoning…" : "Abandon case"}</button>
      </div>
    </div>
  </dialog>
{/if}
