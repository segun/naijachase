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
  import { caseGuide } from "../../domain/case-guide.ts";
  import { caseHints } from "../../ui/case-hints.svelte.ts";
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
  const waiting = $derived(app.coop.requests.filter(r => coopActions(r, app.player?.username ?? "").length).length);

  let menuOpen = $state(false);
  let menuDialog = $state<HTMLDialogElement>();
  let abandonOpen = $state(false);
  let abandonDialog = $state<HTMLDialogElement>();
  let leaving = $state("");
  let notebookFocus = $state<{ stop: string; venueId: string; venueLabel: string } | null>(null);
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
    { screen: "investigate", label: "Investigate", icon: "search", key: "L", count: `${done.length}/${venues.length || "…"}` },
    { screen: "notebook", label: "Witness accounts", icon: "notebook", key: "B", count: String(app.notes.length) },
    { screen: "dossier", label: "Suspect profile", icon: "id", key: "D", count: `${dossierCount(gs.dossier)}/8` },
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
  const guide = $derived(caseGuide(gs, app.screen, Boolean(transit)));
  const arrestStage = $derived(gs.stage >= TOTAL_STOPS - 1 && gs.trail_status === "hot");
  const cluesOpen = $derived(app.screen === "notebook" || app.screen === "dossier");
  const raiding = $derived(app.screen === "warrant" && Boolean(gs.warrant_suspect));
  const panelKey = $derived(`${app.screen}:${raiding ? gs.warrant_suspect : ""}`);
  const mainItems = $derived<(Item & { hint: string; active: boolean; disabled?: boolean })[]>([
    { screen: "investigate", label: "Investigate", icon: "search", key: "L", hint: `${done.length}/${venues.length || "…"} witnesses questioned`, active: app.screen === "investigate" },
    { screen: "notebook", label: "Clues", icon: "notebook", key: "B", hint: "Accounts & suspect profile", active: cluesOpen },
    { screen: arrestStage ? "warrant" : "travel", label: arrestStage ? "Catch suspect" : "Travel", icon: arrestStage ? "warrant" : "plane", key: arrestStage ? "W" : "T", hint: arrestStage ? "Warrant & hideouts" : "Choose your next destination", active: app.screen === "travel" || app.screen === "warrant", disabled: Boolean(transit) }
  ]);

  // The terminal scrolls inside the room, not the window. Start each tool at its heading.
  $effect(() => {
    const panel = panelKey;
    if (!root || !awake) return;
    root.querySelector(".t-body")?.scrollTo({ top: 0 });
    root.querySelector(".t-main")?.scrollTo({ top: 0 });
  });

  // A modal lives in the browser's top layer, outside the terminal's scroll/clipping.
  $effect(() => {
    const dialog = menuDialog;
    if (!menuOpen || !dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); opener?.focus?.({ preventScroll: true }); };
  });

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
    const panel = panelKey;
    if (!awake || !root || focused === panel) return;
    focused = panel;
    queueMicrotask(() => root?.querySelector<HTMLElement>(raiding ? "[data-case-heading]" : caseHints.visible ? ".case-guide h2" : ".t-main")?.focus({ preventScroll: true }));
  });

  function toggleHints() {
    caseHints.setVisible(!caseHints.visible);
    menuOpen = false;
    queueMicrotask(() => root?.querySelector<HTMLElement>(raiding ? "[data-case-heading]" : caseHints.visible ? ".case-guide h2" : ".t-main")?.focus({ preventScroll: true }));
  }

  function open(screen: Screen) {
    menuOpen = false;
    notebookFocus = null;
    if (!leaving) app.go(screen);
  }

  async function pick(lead: QuoteGroup) {
    if (leaving || transit) return;
    if (done.includes(lead.id)) {
      notebookFocus = { stop: gs.current_state, venueId: lead.id, venueLabel: lead.label };
      app.go("notebook");
      return;
    }
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

<div class="crt-screen office-terminal" class:on={awake} bind:this={root} aria-label="Agency terminal: case" role="region">
  <div class="t-content t-case-content">
    <div class="t-top">
      <header class="t-bar">
        <button class="mobile-case-menu" type="button" aria-expanded={menuOpen} aria-haspopup="dialog" aria-controls="case-menu-dialog" onclick={() => (menuOpen = !menuOpen)}>More</button>
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
        <ul class="t-list desktop-case-tools">
          {#each mainItems as item}
            <li>
              <button class="t-opt" class:active={item.active} type="button" data-nav aria-current={item.active ? "page" : undefined} disabled={Boolean(leaving) || item.disabled} onclick={() => open(item.screen)}>
                <Icon name={item.icon} /><span class="t-label">{item.label}<small>{item.hint}</small></span><kbd>{item.key}</kbd>
              </button>
            </li>
          {/each}
        </ul>
        <button class="t-opt t-menu desktop-case-tools" type="button" data-nav aria-expanded={menuOpen} aria-haspopup="dialog" aria-controls="case-menu-dialog" onclick={() => (menuOpen = !menuOpen)}>
          <span class="t-glyph" aria-hidden="true">{menuOpen ? "▾" : "▸"}</span><span class="t-label">More</span><kbd>M</kbd>
        </button>

      </nav>

      <main class="t-main" id="terminal-main" aria-label={title} tabindex="-1">
        {#if app.screen === "investigate" && !weekly}
          <HireAssistant {app} disabled={Boolean(leaving)} />
        {/if}
        {#if caseHints.visible && !raiding}
        <section class="case-guide" aria-label="What to do next">
          <div class="guide-heading">
            <span class="guide-label">{weekly ? "Weekly case" : app.isReplay ? "Replay" : "Your next step"} · Stop {Math.min(gs.stage + 1, TOTAL_STOPS)}/{TOTAL_STOPS}</span>
            <button class="guide-hide" type="button" aria-label="Hide next-step hints. Show them again from More." onclick={toggleHints}>Hide hints</button>
          </div>
          <h2 tabindex="-1">{guide.title}</h2>
          <p>{guide.instruction}</p>
          {#if guide.action && guide.action.screen !== app.screen}
            <button class="btn btn-primary" type="button" disabled={app.busy || Boolean(leaving)} onclick={() => guide.action && open(guide.action.screen)}>{guide.action.label}<Icon name="arrow" /></button>
          {/if}
        </section>
        {/if}
        {#if cluesOpen}
          <nav class="case-clue-tabs" aria-label="Clue tools">
            <button type="button" aria-current={app.screen === "notebook" ? "page" : undefined} onclick={() => open("notebook")}>Witness accounts</button>
            <button type="button" aria-current={app.screen === "dossier" ? "page" : undefined} onclick={() => open("dossier")}>Suspect profile · {dossierCount(gs.dossier)}/8</button>
          </nav>
        {/if}
        {#if app.screen === "investigate"}
          <section class="t-leads" aria-labelledby="leads-title">
            <h1 class="t-greet" id="leads-title">Question witnesses</h1>
            {#if transit}{@render travelling()}{:else}
            <LeadGrid leads={venues} closedUntil={app.isWeekly ? q => opensAt(app.game?.state.elapsed ?? 0, q) : undefined} loaded={app.quotesLoaded} {leaving} questioned={done} onpick={pick} />
            {/if}

            {#if !weekly}
              <details class="case-extra-tools">
                <summary>Need help? More investigation tools</summary>
                <div class="case-help-guide">
                  <h2>How to solve this case</h2>
                  <ol>
                    <li>Question witnesses at the places listed above.</li>
                    <li>Read their saved accounts in Clues. Use place clues to choose your next state in Travel.</li>
                    <li>Record descriptions of the thief in the suspect profile. You need all eight details.</li>
                    <li>At the final stop, question the witnesses, match your profile to a suspect, then request a warrant and search the hideouts.</li>
                  </ol>
                  <p><strong>Right now: {guide.title}.</strong> {guide.instruction}</p>
                  {#if guide.action && guide.action.screen !== app.screen}
                    <button class="t-opt" type="button" disabled={app.busy || Boolean(leaving)} onclick={() => guide.action && open(guide.action.screen)}>{guide.action.label}<Icon name="arrow" /></button>
                  {/if}
                </div>
                <Pressure {app} {venues} questioned={done} />
                {#if cooperationAvailable(app.coop.prefs) && app.coop.prefs?.enabled && app.game?.attempt_kind === "ordinary"}
                  <div class="t-embed t-inline"><AskForHelp {app} /></div>
                {/if}
              </details>
            {/if}
            {#if caseHints.visible}<p class="t-line t-hint">{done.length === 0 ? "Start by questioning someone. Their account is saved to your notebook." : "Compare what you've heard. When a destination stands out, open Travel."}</p>{/if}
          </section>
        {:else}
          <div class="t-embed">
            {#if app.screen === "notebook"}<Notebook {app} focus={notebookFocus} />
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
    <nav class="mobile-case-nav" aria-label="Main case navigation">
      <button type="button" aria-current={app.screen === "investigate" ? "page" : undefined} disabled={Boolean(leaving)} onclick={() => open("investigate")}><Icon name="search" /><span>Investigate</span></button>
      <button type="button" aria-current={cluesOpen ? "page" : undefined} disabled={Boolean(leaving)} onclick={() => open("notebook")}><Icon name="notebook" /><span>Clues</span></button>
      <button type="button" aria-current={app.screen === "travel" || app.screen === "warrant" ? "page" : undefined} disabled={Boolean(leaving) || Boolean(transit)} onclick={() => open(arrestStage ? "warrant" : "travel")}><Icon name={arrestStage ? "warrant" : "plane"} /><span>{arrestStage ? "Catch suspect" : "Travel"}</span></button>
    </nav>
  </div>
  {#if menuOpen}
    <dialog id="case-menu-dialog" class="case-menu-dialog" bind:this={menuDialog} aria-labelledby="case-menu-title"
      oncancel={e => { e.preventDefault(); menuOpen = false; }}
      onclick={e => { if (e.target === menuDialog) menuOpen = false; }}>
      <div class="case-menu-panel">
        <header class="case-menu-heading">
          <h2 id="case-menu-title">More options</h2>
          <button class="t-opt case-menu-close" type="button" onclick={() => (menuOpen = false)}>Close<Icon name="x" /></button>
        </header>
        <nav class="case-menu-items" aria-label="More case options">
          <ul class="t-list">
            <li><button class="t-opt" type="button" onclick={toggleHints}><Icon name="info" /><span class="t-label">{caseHints.visible ? "Hide next-step hints" : "Show next-step hints"}</span></button></li>
            <li><button class="t-opt" type="button" onclick={() => open("warrant")}><Icon name="warrant" /><span class="t-label">Warrant &amp; hideouts</span></button></li>
            {#each menu as item}
              {@const n = item.count?.() ?? 0}
              <li><button class="t-opt" type="button" data-nav onclick={() => open(item.screen)}><Icon name={item.icon} /><span class="t-label">{item.label}</span>{#if n}<span class="t-count">{n}</span>{/if}</button></li>
            {/each}
            {#if app.game?.attempt_kind === "ordinary" && app.game.state.outcome === null}
              <li><button class="t-opt t-danger" type="button" data-nav disabled={app.busy || Boolean(leaving)} onclick={() => { menuOpen = false; abandonOpen = true; }}><Icon name="logout" /><span class="t-label">Abandon case</span></button></li>
            {/if}
            <li><button class="t-opt t-danger" type="button" data-nav disabled={app.busy} onclick={() => { menuOpen = false; app.logout(); }}><Icon name="logout" /><span class="t-label">Log out</span></button></li>
          </ul>
        </nav>
      </div>
    </dialog>
  {/if}
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
