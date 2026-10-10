<script lang="ts">
  // The agency terminal: the retro screen the player lands on after signing in. It owns the greeting, the rank, the
  // new-case call to action, achievements, the career file and the menu that leads to every other screen.
  import { onMount, untrack } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { charsPerTick, dossierLines, TICK_MS, totalChars, typedRows } from "../../domain/briefing.ts";
  import { dayPart, greeting } from "./room-scene.ts";
  import { MAP_H, MAP_W, outlinePath, statePoint } from "../../domain/map.ts";
  import { coopActions, groupQuotes, ratio, STATES, type QuoteGroup, type Screen } from "../../domain/model.ts";
  import AvatarSilhouette from "../../avatar/AvatarSilhouette.svelte";
  import Icon from "../../ui/Icon.svelte";
  import LeadGrid from "./LeadGrid.svelte";
  import HireAssistant from "../../screens/case/HireAssistant.svelte";
  import { formatWhen, jailRemaining } from "../../domain/pressure.ts";

  // Re-check the catalogue and release notices every time the desk opens.
  $effect(() => { void app.loadProgression(); });

  let { app, awake = true, leave = async () => {} }: { app: AppController; awake?: boolean; leave?: () => Promise<void> } = $props();

  type View = "home" | "achievements" | "career";
  let view = $state<View>("home");
  let menuOpen = $state(false);
  let typed = $state("");
  let now = $state(new Date());
  let root = $state<HTMLElement>();

  // The briefing: right after a case opens, its dossier types itself onto the screen, then the local leads are offered.
  // Choosing a lead plays the exit animation (the player walks out of the room) before the investigation opens.
  let step = $state<"typing" | "leads">("typing");
  let chars = $state(0);
  let leaving = $state("");
  const lines = $derived(app.game ? dossierLines(app.game) : []);
  const dossier = $derived(typedRows(lines, chars));
  const leads = $derived(groupQuotes(app.quotes, "local"));

  const earned = $derived(new Map((app.summary?.achievements ?? []).map(a => [a.achievement_id, a.earned_at])));
  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const hello = $derived(`${greeting(now)}, ${app.investigator}.`);
  const waiting = $derived(app.coop.requests.filter(r => coopActions(r, app.player?.username ?? "").length).length);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  // Things that need the player's attention, shown on the desk so they don't have to open the menu to find them.
  const pending = $derived.by(() => {
    const items: { screen: Screen; icon: string; label: string; hint: string }[] = [];
    const inv = app.groups.invitations;
    if (inv.length) items.push({ screen: "groups", icon: "users", label: `Groups: ${plural(inv.length, "pending invitation", "pending invitations")}`, hint: inv.length === 1 ? `${inv[0]!.group_name} is waiting for your answer` : "Accept or decline them" });
    if (waiting) items.push({ screen: "helpers", icon: "helper", label: `Helpers: ${plural(waiting, "request needs", "requests need")} you`, hint: "A co-op request is waiting for your action" });
    return items;
  });
  const clock = $derived(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  const day = $derived(now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }));
  const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches || app.settings.motion === "reduced";
  const visited = $derived((app.summary?.visited_states ?? []).map(s => statePoint(s)).filter(p => p !== null));
  const mood = $derived({ morning: "A fresh day. The trail is still warm.", afternoon: "The city is busy. So is the thief.", evening: "Quiet hours. The best time to think." }[dayPart(now.getHours())]);

  const menu: { screen: Screen; label: string; icon: string; count?: () => number }[] = [
    { screen: "archive", label: "Case archive", icon: "archive", count: () => app.archive.length },
    { screen: "groups", label: "Groups", icon: "users", count: () => app.groups.invitations.length },
    { screen: "weekly", label: "Weekly", icon: "trophy" },
    { screen: "helpers", label: "Helpers", icon: "helper", count: () => waiting },
    { screen: "tokens", label: "Bribe tokens", icon: "star", count: () => app.tokenBalance ?? 0 },
    { screen: "settings", label: "Settings", icon: "sliders" }
  ];

  onMount(() => {
    const tick = setInterval(() => { now = new Date(); }, 20000);
    // Server time is authoritative: while suspended, ask it again every minute.
    const jail = setInterval(() => { if (app.jailedUntil) void app.loadTokens(); }, 60000);
    return () => { clearInterval(tick); clearInterval(jail); };
  });

  // The greeting types itself out once the screen is awake; reduced motion shows it at once.
  $effect(() => {
    const text = hello;
    if (!awake) { typed = ""; return; }
    if (quiet()) { typed = text; return; }
    let i = 0;
    const timer = setInterval(() => { typed = text.slice(0, ++i); if (i >= text.length) clearInterval(timer); }, 42);
    return () => clearInterval(timer);
  });

  // Types the dossier out when a case is opened and then waits: the player reads at their own pace and chooses to continue.
  // Reduced motion shows it all at once.
  $effect(() => {
    const id = app.briefing && awake ? app.game?.case_id : undefined;
    if (!id) return;
    const total = untrack(() => totalChars(lines));
    untrack(() => { step = "typing"; chars = 0; leaving = ""; });
    if (quiet()) { chars = total; return; }
    const rate = charsPerTick(total);
    const timer = setInterval(() => {
      chars = Math.min(total, chars + rate);
      if (chars >= total) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  });

  /** While typing, Enter or Space finishes the typing; once it is all on screen, they continue to the leads. A stray click never skips ahead. */
  function advance() {
    if (step !== "typing") return;
    if (chars < totalChars(lines)) chars = totalChars(lines);
    else step = "leads";
  }

  async function pick(lead: QuoteGroup) {
    if (leaving) return;
    leaving = lead.id;
    await leave();
    app.finishBriefing(lead.id);
  }

  $effect(() => {
    if (app.briefing && step === "typing" && dossier.done) queueMicrotask(() => root?.querySelector<HTMLElement>(".t-continue [data-primary]")?.focus({ preventScroll: true }));
  });

  // Hand keyboard focus to the main action the first time the screen wakes.
  let focused = false;
  $effect(() => {
    if (awake && !focused && root) { focused = true; root.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true }); }
  });

  function open(next: View) {
    view = next; menuOpen = false;
    queueMicrotask(() => root?.querySelector<HTMLElement>("[data-back], [data-primary]")?.focus({ preventScroll: true }));
  }

  function keys(e: KeyboardEvent) {
    if (document.querySelector("dialog[open]")) return;
    if (app.briefing) {
      if (!awake || leaving || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "Enter" || e.key === " ") && step === "typing" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); advance(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    }
    if (!awake || e.metaKey || e.ctrlKey || e.altKey || /^(TEXTAREA|SELECT)$/.test((e.target as HTMLElement | null)?.tagName ?? "")) return;
    const k = e.key.toLowerCase();
    if (k === "escape") { if (menuOpen) menuOpen = false; else if (view !== "home") open("home"); else return; }
    else if (k === "m") menuOpen = !menuOpen;
    else if (k === "a") open("achievements");
    else if (k === "c") open("career");
    else if (k === "n" && !app.busy && !app.exhausted && app.canStartCase) void app.openCase();
    else if (k === "arrowdown" || k === "arrowup") {
      const items = [...(root?.querySelectorAll<HTMLElement>("[data-nav]:not([disabled])") ?? [])];
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      items[(at + (k === "arrowdown" ? 1 : -1) + items.length) % items.length]!.focus();
    } else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={keys} />

<div class="crt-screen" class:on={awake} bind:this={root} aria-label="Agency terminal" role="region">
  <div class="t-content">
    <header class="t-bar">
      <span class="t-title"><Icon name="pin" /> NAIJA CHASE <small>// AGENCY TERMINAL</small></span>
      <span class="t-clock" aria-label="Local time">{day} · {clock}</span>
    </header>

    <div class="t-body">
      <nav class="t-side" aria-label="Menu">
        {#if !app.briefing}<button class="t-opt t-menu" type="button" data-nav aria-expanded={menuOpen} aria-controls="t-menu-list" onclick={() => (menuOpen = !menuOpen)}>
          <span class="t-glyph" aria-hidden="true">{menuOpen ? "▾" : "▸"}</span><span class="t-label">Menu</span><kbd>M</kbd>
        </button>{/if}
        {#if menuOpen && !app.briefing}
          <ul id="t-menu-list" class="t-list">
            {#each menu as item}
              {@const n = item.count?.() ?? 0}
              <li><button class="t-opt" type="button" data-nav onclick={() => app.go(item.screen)}><Icon name={item.icon} /><span class="t-label">{item.label}</span>{#if n}<span class="t-count">{n}</span>{/if}</button></li>
            {/each}
            <li><button class="t-opt t-danger" type="button" data-nav disabled={app.busy} onclick={() => app.logout()}><Icon name="logout" /><span class="t-label">Log out</span></button></li>
          </ul>
        {:else}
          <div class="t-card">
            <span class="t-portrait" aria-hidden="true">{#if app.avatar}<AvatarSilhouette preset={app.avatar} crop="bust" />{:else}<Icon name="user" />{/if}</span>
            <strong class="t-name">{app.investigator}</strong>
            <span class="t-sub">{app.summary?.rank ?? "Investigator"}</span>
            {#if app.player}<span class="t-sub"><Icon name="pin" /> Home base · {app.player.home_base}</span>{/if}
          </div>
          <svg class="t-map" viewBox="0 0 {MAP_W} {MAP_H}" role="img" aria-label="{visited.length} of {STATES.length} jurisdictions visited">
            <path d={outlinePath()} />
            {#each visited as p}<circle cx={p.x} cy={p.y} r="16" />{/each}
          </svg>
        {/if}
      </nav>

      <main class="t-main" id="terminal-main">
        {#if app.briefing}
          {#if step === "typing"}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
            <section class="t-file" aria-label="Case dossier" onclick={() => { chars = totalChars(lines); }}>
              <h1 class="t-greet">Case dossier</h1>
              <p class="sr-only" role="status">{lines.map(l => `${l.label}: ${l.value}`).join(". ")}</p>
              <dl class="t-dossier" aria-hidden="true">
                {#each dossier.rows as row, i}
                  <div><dt>{row.label}</dt><dd>{row.value}{#if i === dossier.rows.length - 1 && !dossier.done}<span class="t-cursor"></span>{/if}</dd></div>
                {/each}
              </dl>
              <div class="t-continue">
                {#if dossier.done}<button class="t-opt t-big t-hot" type="button" data-nav data-primary onclick={e => { e.stopPropagation(); step = "leads"; }}><Icon name="map" /><span class="t-label">Continue<small>Take your time. Next: the local leads</small></span><kbd>Enter</kbd><Icon name="arrow" /></button>{/if}
              </div>
            </section>
          {:else}
            <section class="t-leads" aria-labelledby="leads-title">
              <h1 class="t-greet" id="leads-title">Local leads{#if app.game}<HireAssistant {app} />{/if}</h1>
              <p class="t-line">{app.game?.state.current_state}. Pick where to start asking: one witness here knows where the thief went next.</p>
              <LeadGrid {leads} loaded={app.quotesLoaded} {leaving} onpick={pick} />
              <button class="t-opt t-small t-quiet" type="button" data-nav disabled={Boolean(leaving)} onclick={() => app.finishBriefing()}>Skip to the case <Icon name="arrow" /></button>
            </section>
          {/if}
        {:else if view === "home"}
          <h1 class="t-greet"><span class="sr-only">{hello}</span><span aria-hidden="true">{typed}</span><span class="t-cursor" aria-hidden="true"></span></h1>
          <p class="t-line">{mood}</p>

          <section class="t-rank" aria-label="Your rank">
            {#if app.summary}
              <span class="t-badge" aria-hidden="true"><Icon name="star" /></span>
              <div class="t-rank-text"><span class="t-tag">Rank</span><strong>{app.summary.rank}</strong></div>
              <dl class="t-stats">
                <div><dt>Points</dt><dd>{app.summary.points.toLocaleString()}</dd></div>
                <div><dt>Tokens</dt><dd>{app.tokenBalance ?? "…"}</dd></div>
                <div><dt>Solved</dt><dd>{app.summary.solved_cases}</dd></div>
                <div><dt>Regions</dt><dd>{app.summary.visited_states.length}<small>/{STATES.length}</small></dd></div>
              </dl>
            {:else}<span class="t-wait" role="status">Reading your file…</span>{/if}
          </section>

          {#if app.jailedUntil}
            <section class="t-alert" role="status" aria-label="Suspension">
              <Icon name="lock" />
              <span class="t-alert-text">You are suspended from new cases until {formatWhen(app.jailedUntil)} ({jailRemaining(app.jailedUntil, now)}). Settings, history and support stay available.</span>
              <button class="t-opt t-small" type="button" data-nav onclick={() => app.go("tokens")}>History <Icon name="arrow" /></button>
            </section>
          {/if}

          {#if app.releases.length}
            <section class="t-alert" role="status" aria-label="New cases">
              <Icon name="bell" />
              <span class="t-alert-text">{app.releases.length === 1 ? "New case available" : `${app.releases.length} new cases available`}</span>
              <button class="t-opt t-small" type="button" data-nav disabled={app.busy} onclick={() => app.followRelease()}>Open <Icon name="arrow" /></button>
              <button class="t-opt t-small t-quiet" type="button" data-nav onclick={() => app.releases.forEach(n => app.dismissRelease(n.notification_id))}>Dismiss</button>
            </section>
          {/if}

          <div class="t-actions">
            {#if app.caseId}
              <button class="t-opt t-big" type="button" data-nav data-primary disabled={app.busy} onclick={() => app.resume()}>
                <Icon name="notebook" /><span class="t-label">{app.game?.attempt_kind === "replay" ? "Resume replay" : "Resume case"}<small>{app.game?.state.case_dossier.title ?? "Saved case file"} · pick up where you left off</small></span>
                {#if app.busy}<span class="spinner"></span>{:else}<Icon name="arrow" />{/if}
              </button>
            {/if}
            {#if app.exhausted}
              <section class="t-alert" role="status" aria-label="Catalogue complete">
                <Icon name="trophy" />
                <span class="t-alert-text">Catalogue complete: you have solved every case published so far. New cases arrive as they are published.</span>
              </section>
              <button class="t-opt t-big" type="button" data-nav data-primary={app.caseId ? undefined : ""} onclick={() => app.go("archive")}>
                <Icon name="archive" /><span class="t-label">Case archive<small>Replay any solved case, or wait for new ones</small></span><Icon name="arrow" />
              </button>
              <button class="t-opt t-big" type="button" data-nav onclick={() => app.go("weekly")}>
                <Icon name="bell" /><span class="t-label">Notification settings<small>Choose how you hear about new cases and events</small></span><Icon name="arrow" />
              </button>
            {:else}
              <button class="t-opt t-big t-hot" type="button" data-nav data-primary={app.caseId ? undefined : ""} disabled={app.busy || !app.canStartCase} onclick={() => app.openCase()}>
                <Icon name="search" />
                <span class="t-label">{app.busy ? `${app.busyLabel}…` : "Start new case"}<small>{!app.activityKnown ? "Refresh case status before starting a new case." : app.ordinaryCaseId ? "Resume or abandon your ongoing ordinary case first" : app.catalogue ? `${app.catalogue.completed.toLocaleString()} of ${app.catalogue.published.toLocaleString()} solved` : "The agency picks one you haven't solved"}</small></span>
                {#if app.busy}<span class="spinner"></span>{:else}<kbd>N</kbd><Icon name="arrow" />{/if}
              </button>
            {/if}
            {#if !app.activityKnown}
              <button class="t-opt" type="button" data-nav disabled={app.busy} onclick={() => app.refreshCaseDesk()}>
                <Icon name="notebook" /><span class="t-label">Refresh case status<small>Check the server for ongoing cases</small></span><Icon name="arrow" />
              </button>
            {/if}
            <div class="t-pair">
              <button class="t-opt" type="button" data-nav onclick={() => open("achievements")}><Icon name="trophy" /><span class="t-label">Achievements<small>{earned.size} of {app.catalog.length}</small></span><kbd>A</kbd></button>
              <button class="t-opt" type="button" data-nav onclick={() => open("career")}><Icon name="id" /><span class="t-label">Career file<small>Accuracy &amp; promotions</small></span><kbd>C</kbd></button>
            </div>
            {#each pending as p (p.screen)}
              <button class="t-opt" type="button" data-nav onclick={() => app.go(p.screen)}>
                <Icon name={p.icon} /><span class="t-label">{p.label}<small>{p.hint}</small></span><Icon name="arrow" />
              </button>
            {/each}
          </div>
          {#if app.catalogue}
            <div class="t-progress">
              <span>Case files</span>
              <div class="t-meter" role="progressbar" aria-label="Cases solved" aria-valuemin="0" aria-valuemax={app.catalogue.published} aria-valuenow={app.catalogue.completed}><span style:width="{app.catalogue.percent}%"></span></div>
              <span>{app.catalogue.completed.toLocaleString()} / {app.catalogue.published.toLocaleString()}</span>
            </div>
          {/if}

        {:else if view === "achievements"}
          <div class="t-head">
            <button class="t-opt t-small" type="button" data-nav data-back onclick={() => open("home")}>◂ Back</button>
            <h1>Achievements</h1><span class="t-sub">{earned.size} of {app.catalog.length} earned</span>
          </div>
          <ul class="t-grid">
            {#each app.catalog as a}
              <li class:earned={earned.has(a.id)}>
                <span class="t-medal" aria-hidden="true"><Icon name={earned.has(a.id) ? "trophy" : "lock"} /></span>
                <div><strong>{a.title}</strong><span>{a.description}</span>{#if earned.has(a.id)}<small>Earned {date(earned.get(a.id)!)}</small>{:else}<small>Locked</small>{/if}</div>
              </li>
            {/each}
          </ul>

        {:else}
          <div class="t-head">
            <button class="t-opt t-small" type="button" data-nav data-back onclick={() => open("home")}>◂ Back</button>
            <h1>Career file</h1><span class="t-sub">{app.summary?.rank ?? ""}</span>
          </div>
          {#if app.summary}
            <div class="t-career">
              <section><h2>Accuracy</h2>
                <dl class="t-rows">
                  <div><dt>Correct travels</dt><dd>{ratio(app.summary.correct_travels, app.summary.wrong_travels)}</dd></div>
                  <div><dt>Correct deductions</dt><dd>{ratio(app.summary.correct_deductions, app.summary.wrong_deductions)}</dd></div>
                  <div><dt>Career points</dt><dd>{app.summary.points.toLocaleString()}</dd></div>
                  <div><dt>Cases solved</dt><dd>{app.summary.solved_cases}</dd></div>
                  <div><dt>Jurisdictions</dt><dd>{app.summary.visited_states.length} / {STATES.length}</dd></div>
                </dl>
              </section>
              <section><h2>Rank history</h2>
                {#if app.summary.rank_history.length}
                  <ol class="t-trail">
                    {#each app.summary.rank_history as r}
                      <li class:current={r.new_rank === app.summary.rank}><span class="t-dot" aria-hidden="true"></span>{r.new_rank}<small>{date(r.earned_at)}</small></li>
                    {/each}
                  </ol>
                {:else}<p class="t-line">No promotions yet. Solve cases to rise through the ranks.</p>{/if}
              </section>
            </div>
          {:else}<p class="t-wait" role="status">Reading your file…</p>{/if}
        {/if}
      </main>
    </div>

    <footer class="t-status" aria-hidden="true">
      <span><kbd>↑</kbd><kbd>↓</kbd> select</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> back</span>
      <span class="t-blink">● online</span>
    </footer>
  </div>
  <div class="crt-fx" aria-hidden="true"></div>
</div>
