<script lang="ts">
  // After the briefing: the player comes through the office door into the garage and the two ways to reach the chosen lead are
  // offered as animated cards (Drive, or Hitch a ride on foot). Choosing one sends the visit to the server first; only when the
  // server accepts does the player climb into the car and drive off, or set off for the roadside; then the witness scene plays
  // (for venues that have one) and the investigation opens.
  import "../../styles/terminal.css";
  import type { AppController } from "../../state/app.svelte";
  import { MODE_FOR, type Exit } from "./garage-scene.ts";
  import { MODE_LABEL, duration, groupQuotes, money, project, type QuoteGroup, type TransportQuote } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";
  import Stage from "../shared/Stage.svelte";

  let { app }: { app: AppController } = $props();

  // The lead is fixed for this visit: the garage is entered with it and never changes it.
  // svelte-ignore state_referenced_locally
  const venueId = app.pendingLead;
  let snapshot = $state<QuoteGroup | null>(null);
  let chosen = $state<Exit | "">("");
  let failed = $state(false);

  // Quotes can change while the player drives off (the server refreshes them after the visit), so keep the ones they chose from.
  $effect(() => {
    if (chosen) return;
    const live = groupQuotes(app.quotes, "local").find(g => g.id === venueId);
    if (live) snapshot = live;
    else if (app.quotesLoaded && !snapshot) app.leaveGarage();
  });

  const gs = $derived(app.game?.state);
  const options = $derived((["drive", "hitch"] as Exit[]).map(how => {
    const quote = snapshot?.options.find(o => o.mode === MODE_FOR[how]) ?? null;
    return { how, quote, plan: quote && gs ? project(gs.elapsed, gs.balance, quote) : null };
  }));

  async function go(how: Exit, quote: TransportQuote, leave: (how?: string) => Promise<void>) {
    if (chosen || app.busy || !quote.affordable) return;
    chosen = how; failed = false;
    const ok = await app.command({ type: "visit_venue", venue_id: venueId, mode: quote.mode as "drive" | "hitch_ride" }, "Witness interviewed.", "Interviewing witness");
    if (!ok) { chosen = ""; failed = true; return; }
    await leave(how);
    app.arriveAtWitness(how);
  }

  const key = (e: KeyboardEvent, awake: boolean, leave: (how?: string) => Promise<void>) => {
    if (!awake || chosen || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const pick = k === "d" || k === "1" ? options[0] : k === "h" || k === "2" ? options[1] : undefined;
    if (pick?.quote) { e.preventDefault(); void go(pick.how, pick.quote, leave); }
    else if (k === "escape") { e.preventDefault(); app.leaveGarage(); }
  };
</script>

<Stage {app} sheet="dock" loading="Opening the garage…" load={(canvas, options) => import("./chase3d-garage.ts").then(m => m.createGarageScene(canvas, options))}>
  {#snippet children(awake, leave)}
    <section class="garage" class:on={awake} aria-label="How will you get there?" {@attach () => { const onkey = (e: KeyboardEvent) => key(e, awake, leave); window.addEventListener("keydown", onkey); return () => window.removeEventListener("keydown", onkey); }}>
      <header class="garage-head">
        <h1>Heading to the {snapshot?.label.toLowerCase() ?? "lead"}</h1>
        <button class="btn btn-ghost" type="button" disabled={Boolean(chosen)} onclick={() => app.leaveGarage()}>Not now <kbd>Esc</kbd></button>
      </header>
      <div class="garage-options" role="group" aria-label="Transport">
        {#each options as { how, quote, plan } (how)}
          <button class="ride" class:picked={chosen === how} type="button" disabled={Boolean(chosen) || !quote || !quote.affordable} onclick={() => quote && go(how, quote, leave)}>
            <span class="ride-art" aria-hidden="true">
              {#if how === "drive"}
                <svg viewBox="0 0 160 70" focusable="false">
                  <g class="road"><path d="M0 62H160" /><path class="dash" d="M0 66H160" /></g>
                  <g class="bob"><path class="body" d="M14 50V38q0-5 6-6l22-2 14-12h30l14 12 14 2q8 2 8 8v10z" /><path class="glass" d="M58 30l9-9h22l10 9z" /><path class="glass" d="M44 31l12-10" /><circle class="lamp" cx="136" cy="42" r="3.5" /></g>
                  <g class="wheel"><circle cx="42" cy="54" r="10" /><path d="M42 44v20M32 54h20" /></g>
                  <g class="wheel"><circle cx="118" cy="54" r="10" /><path d="M118 44v20M108 54h20" /></g>
                </svg>
              {:else}
                <svg viewBox="0 0 160 70" focusable="false">
                  <g class="road"><path d="M0 62H160" /><path class="dash" d="M0 66H160" /></g>
                  <g class="stroll">
                    <circle class="head" cx="78" cy="14" r="7" /><path class="torso" d="M78 21V40" />
                    <path class="leg l1" d="M78 40L68 60" /><path class="leg l2" d="M78 40L88 60" />
                    <path class="arm" d="M78 26L66 38" /><path class="thumb-arm" d="M78 26L92 16L96 6" /><path class="thumb" d="M96 6L100 3" />
                  </g>
                  <g class="dust"><circle cx="30" cy="58" r="2" /><circle cx="22" cy="55" r="1.5" /><circle cx="130" cy="58" r="2" /></g>
                </svg>
              {/if}
            </span>
            <span class="ride-name">{MODE_LABEL[MODE_FOR[how]]}<kbd>{how === "drive" ? "D" : "H"}</kbd></span>
            <span class="ride-note">{how === "drive" ? "Your runabout is fuelled and waiting. Quicker, but it costs." : "Free, but you wait by the road and it can take a lot of time."}</span>
            {#if quote && plan}
              <span class="ride-figures">
                <b>{quote.cost === 0 ? "Free" : money(quote.cost)}</b>
                <span>{duration(plan.totalMinutes)}</span>
                <span>Arrive {plan.arrival}</span>
                <span>Balance after {money(plan.balanceAfter)}</span>
              </span>
              {#if !quote.affordable}<span class="ride-warn"><Icon name="alert" /> You can't afford this one.</span>
              {:else if plan.missesDeadline}<span class="ride-warn"><Icon name="alert" /> Arrives after the deadline.</span>{/if}
            {:else}<span class="ride-figures">{app.quotesLoaded ? "Not available" : "Checking fares…"}</span>{/if}
            {#if chosen === how}<span class="ride-go"><span class="spinner"></span> {app.busy ? "Confirming with the agency…" : "Off you go…"}</span>{/if}
          </button>
        {/each}
      </div>
      {#if failed}<p class="garage-error" role="alert">That didn't go through. Check the fare and try again.</p>{/if}
    </section>
  {/snippet}
</Stage>
