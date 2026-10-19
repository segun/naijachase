<script lang="ts">
  // The journey between two states: out of the garage in a car, into a minibus at the bus park, or through an airport and onto a plane, then
  // on to the desk. Full/Standard share the timeline; Simple bypasses ordinary journeys and keeps weekly server progress readable.
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import "../../styles/journey.css";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts, secondsLabel } from "../../domain/model.ts";
  import { detail } from "../shared/detail.svelte.ts";
  import { detailKey } from "../shared/detail-level.ts";
  import type { JourneyHandle } from "./journey-driver.ts";
  import { reportSceneFallback } from "../../telemetry.ts";

  type Mode = "3d" | "flat";
  const FALLBACK_KEY = "nc-journey-flat";
  const FIRST_FRAME_MS = 9000;
  const STALL_MS = 3000;

  type Visit = { from: string; to: string; mode: "drive" | "hitch" | "fly"; seed: number; label?: string };
  // `loop` is the weekly "show travel route" view: the same scenery with no departure or arrival, running until Esc calls `onclose`.
  // `note` is reserved for meaningful journey status, and `startHour` is the case hour for the lighting.
  let { app, visit: given, loop = false, onclose, note, startHour }: { app: AppController; visit?: Visit; loop?: boolean; onclose?: () => void; note?: string; startHour?: number } = $props();

  // svelte-ignore state_referenced_locally
  const visit = given ?? app.journey;
  const stored = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
  // The picture detail the player chose (or the device allows). It can change at any moment: the scene is rebuilt in the new renderer or
  // detail and carries on from the second it had reached. Failed 3D uses functional content until the player changes the setting.
  const level = $derived(detail.resolved);
  let broken = $state(stored(sessionStorage, FALLBACK_KEY) === "1");
  const mode = $derived<Mode>(level.renderer === "3d" && !broken ? "3d" : "flat");
  const canvasKey = $derived(mode === "3d" ? detailKey(level) : "flat");
  let lastChoice = detail.choice;
  $effect(() => {
    const choice = detail.choice;
    if (choice === lastChoice) return;
    lastChoice = choice; broken = false; failure = "";
    try { sessionStorage.removeItem(FALLBACK_KEY); } catch { /* private mode */ }
  });

  let canvas = $state<HTMLCanvasElement>();
  let ready = $state(false);
  let fade = $state(0);
  let failure = $state("");
  let skip: () => void = () => {};
  let finished = false;
  let resumeAt = 0;
  // svelte-ignore state_referenced_locally
  const hour = startHour ?? clockParts(app.game?.state.elapsed ?? 0).hour;

  // The weekly journey really takes this long: the bar and the figure follow the server's arrival time, never the animation.
  let tick = $state(Date.now());
  $effect(() => { if (!loop) return; const t = setInterval(() => (tick = Date.now()), 1000); return () => clearInterval(t); });
  const trip = $derived(loop ? app.weeklyTransit : null);
  const left = $derived(trip ? Math.max(0, Math.round((trip.arrivesAt - tick) / 1000)) : 0);
  const done = $derived(trip && trip.seconds > 0 ? Math.min(100, Math.max(0, Math.round((1 - left / trip.seconds) * 100))) : 0);

  function finish() {
    if (finished) return;
    finished = true;
    if (loop) onclose?.(); else app.leaveJourney();
  }

  function fallBack(at: number, why: string) {
    if (mode !== "3d" || finished) return;
    console.warn(`The 3D journey scene is opening functional content: ${why}`);
    reportSceneFallback("journey", why);
    try { sessionStorage.setItem(FALLBACK_KEY, "1"); } catch { /* private mode: the next scene just tries 3D again */ }
    resumeAt = at; ready = false; failure = why; broken = true;
  }

  $effect(() => {
    if (!visit) { finish(); return; }
    const target = canvas, current = mode, key = canvasKey, { quality, models, reducedMotion } = level;
    if (current === "flat") {
      if (!loop && !failure) finish();
      return;
    }
    if (!target || target.dataset.key !== key) return;
    let cancelled = false;
    const controller = new AbortController();
    let handle: JourneyHandle | undefined;
    let began = 0, lastTick = 0;
    const watchdog = current === "3d" ? setInterval(() => {
      if (document.hidden) { lastTick = performance.now(); return; }
      if (began && performance.now() - (lastTick || began) > (lastTick ? STALL_MS : FIRST_FRAME_MS)) fallBack(handle?.now() ?? 0, "no frames");
    }, 500) : undefined;

    const options = {
      preset: app.avatar, hour, quality, models, signal: controller.signal, mode: visit.mode, from: visit.from, to: visit.to, label: visit.label, reducedMotion, loop,
      seed: visit.seed,
      onTick: () => { if (!cancelled) { lastTick = performance.now(); ready = true; } },
      onFrame: (f: { fade: number }) => { if (!cancelled) fade = f.fade; },
      onSlow: () => { if (!cancelled) fallBack(handle?.now() ?? 0, "low frame rate"); },
      onFault: (why: string) => { if (!cancelled) fallBack(handle?.now() ?? 0, why); }
    };
    const load = import("./chase3d-journey.ts").then(m => {
      if (cancelled) throw new DOMException("Journey setup cancelled", "AbortError");
      began = performance.now(); return m.createJourneyScene3D(target, options);
    });

    load
      .then(h => {
        if (cancelled) { h.dispose(); return; }
        handle = h;
        skip = () => h.skip();
        return h.start(resumeAt || undefined).then(() => { if (!cancelled) finish(); });
      })
      .catch(e => {
        if (cancelled) return;
        console.error(`The ${current} journey scene failed.`, e);
        fallBack(handle?.now() ?? 0, e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true; clearInterval(watchdog);
      if (handle && !finished) resumeAt = handle.now();
      controller.abort();
      handle?.dispose();
    };
  });

  function key(e: KeyboardEvent) {
    if (!["Escape", "Enter", " "].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== "Escape" && e.target instanceof Element && e.target.closest("button, input, select, textarea, a, summary")) return;
    e.preventDefault();
    if (loop || failure || !ready) finish(); else skip();
  }
</script>

<svelte:window onkeydown={key} />

<div class="room witness journey" role="region" aria-label="Travelling to {visit?.label ?? visit?.to ?? 'the next state'}">
  {#if mode === "flat"}
    <section class="journey-flat" aria-label="Journey status">
      <h1>{trip ? "On the way to" : "Journey to"} {visit?.label ?? visit?.to}</h1>
      <p>{visit?.from} → {visit?.label ?? visit?.to}</p>
      {#if failure}
        <p role="alert">The 3D journey is unavailable. Your travel time and destination are unchanged.</p>
        <details><summary>Scene details</summary><p>{failure}</p></details>
      {/if}
      {#if note}<p>{note}</p>{/if}
      {#if loop}<p>The travel progress follows the server's arrival time. Returning to the desk does not shorten the wait.</p>{/if}
      <button class="btn btn-primary" type="button" onclick={finish}>{loop ? "Back to the desk" : "Continue to the desk"}</button>
    </section>
  {:else}
  {#key canvasKey}<canvas class="room-canvas" class:ready data-mode={mode} data-key={canvasKey} bind:this={canvas} aria-hidden="true"></canvas>{/key}
  <div class="witness-fade" style:opacity={1 - fade}></div>
  {#if !ready}<p class="room-loading" role="status">Travelling to {visit?.label ?? visit?.to}…</p>{/if}
  {#if note}
    <div class="witness-caption journey-caption" aria-hidden="true"><p class="caption-line">{note}</p></div>
  {/if}
  {/if}
  {#if trip}
    <div class="journey-progress" role="progressbar" aria-label="Journey progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={done}>
      <div class="jp-ends"><span>{visit?.from}</span><span>{visit?.label ?? visit?.to}</span></div>
      <div class="jp-track"><span class="jp-fill" style:width="{done}%"></span><span class="jp-marker" style:left="{done}%"></span></div>
      <div class="jp-figures"><span>{done}% of the way</span><span>{secondsLabel(left)} to go · {secondsLabel(Math.max(0, trip.seconds - left))} travelled</span></div>
    </div>
  {/if}
  {#if note}<p class="sr-only" role="status">{note}</p>{/if}
  {#if mode === "3d"}<button class="room-skip" type="button" onclick={() => { if (loop || failure || !ready) finish(); else skip(); }}>{loop ? "Back" : "Skip"} <kbd>Esc</kbd></button>{/if}
</div>
