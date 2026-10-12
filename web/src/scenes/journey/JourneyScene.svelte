<script lang="ts">
  // The journey between two states: out of the garage in a car, into a minibus at the bus park, or through an airport and onto a plane, then
  // on to the desk. Same pattern as the witness scene: 3D (Babylon.js) when the device looks capable, otherwise 2D (Canvas 2D), and if 3D
  // fails, stalls or runs too slowly it carries on in 2D from where it had got to. Both read the same timeline (journey-scene.ts).
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import "../../styles/journey.css";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts, secondsLabel } from "../../domain/model.ts";
  import { detail } from "../shared/detail.svelte.ts";
  import { detailKey } from "../shared/detail-level.ts";
  import type { JourneyHandle } from "./journey-driver.ts";

  type Mode = "3d" | "2d";
  /** The witness scene's switch: once 3D has failed on this device in this session, every scene goes straight to 2D. */
  const FALLBACK_KEY = "nc-witness-2d";
  const FIRST_FRAME_MS = 9000;
  const STALL_MS = 3000;

  type Visit = { from: string; to: string; mode: "drive" | "hitch" | "fly"; seed: number; label?: string };
  // `loop` is the weekly "show travel route" view: the same scenery with no departure or arrival, running until Esc calls `onclose`.
  // `note` replaces the caption there (for example once the journey has really ended), and `startHour` is the case hour for the lighting.
  let { app, visit: given, loop = false, onclose, note, startHour }: { app: AppController; visit?: Visit; loop?: boolean; onclose?: () => void; note?: string; startHour?: number } = $props();

  // svelte-ignore state_referenced_locally
  const visit = given ?? app.journey;
  const stored = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
  // The picture detail the player chose (or the device allows). It can change at any moment: the scene is rebuilt in the new renderer or
  // detail and carries on from the second it had reached. 3D that failed earlier in this session stays in 2D until the player changes the setting.
  const level = $derived(detail.resolved);
  let broken = $state(stored(sessionStorage, FALLBACK_KEY) === "1");
  const mode = $derived<Mode>(level.renderer === "3d" && !broken ? "3d" : "2d");
  const canvasKey = $derived(mode === "3d" ? detailKey(level) : `2d-${level.quality}`);
  let lastChoice = detail.choice;
  $effect(() => {
    const choice = detail.choice;
    if (choice === lastChoice) return;
    lastChoice = choice; broken = false;
    try { sessionStorage.removeItem(FALLBACK_KEY); } catch { /* private mode */ }
  });

  let canvas = $state<HTMLCanvasElement>();
  let ready = $state(false);
  let fade = $state(0);
  let caption = $state<string | null>(null);
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
    console.warn(`The 3D journey scene is switching to 2D: ${why}`);
    try { sessionStorage.setItem(FALLBACK_KEY, "1"); } catch { /* private mode: the next scene just tries 3D again */ }
    resumeAt = at; ready = false; broken = true;
  }

  $effect(() => {
    if (!visit) { finish(); return; }
    const target = canvas, current = mode, key = canvasKey, { quality, models, reducedMotion } = level;
    if (!target || target.dataset.key !== key) return;
    let cancelled = false;
    let handle: JourneyHandle | undefined;
    let began = 0, lastTick = 0;
    const watchdog = current === "3d" ? setInterval(() => {
      if (document.hidden) { lastTick = performance.now(); return; }
      if (began && performance.now() - (lastTick || began) > (lastTick ? STALL_MS : FIRST_FRAME_MS)) fallBack(handle?.now() ?? 0, "no frames");
    }, 500) : undefined;

    const options = {
      preset: app.avatar, hour, quality, models, mode: visit.mode, from: visit.from, to: visit.to, label: visit.label, reducedMotion, loop,
      // The 3D scene may hand over to 2D mid-way, so 2D must show the same landscapes: the seed is the same for both.
      seed: visit.seed,
      onTick: () => { lastTick = performance.now(); ready = true; },
      onFrame: (f: { fade: number; caption: string | null }) => { fade = f.fade; caption = f.caption; },
      onSlow: () => fallBack(handle?.now() ?? 0, "low frame rate"),
      onFault: (why: string) => { if (current === "3d") fallBack(handle?.now() ?? 0, why); else failure = why; }
    };
    const load = current === "3d"
      ? import("./chase3d-journey.ts").then(m => { began = performance.now(); return m.createJourneyScene3D(target, options); })
      : import("./journey-2d.ts").then(m => m.createJourneyScene2D(target, options));

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
        if (current === "3d") fallBack(handle?.now() ?? 0, e instanceof Error ? e.message : String(e));
        else failure = e instanceof Error ? e.message : String(e);
      });

    return () => {
      cancelled = true; clearInterval(watchdog);
      if (handle && !finished) resumeAt = handle.now();
      handle?.dispose();
    };
  });

  function key(e: KeyboardEvent) {
    if (!["Escape", "Enter", " "].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (loop || failure || !ready) finish(); else skip();
  }
</script>

<svelte:window onkeydown={key} />

<div class="room witness journey" role="region" aria-label="Travelling to {visit?.label ?? visit?.to ?? 'the next state'}">
  {#key canvasKey}<canvas class="room-canvas" class:ready data-mode={mode} data-key={canvasKey} bind:this={canvas} aria-hidden="true"></canvas>{/key}
  <div class="witness-fade" style:opacity={1 - fade}></div>
  {#if failure}
    <div class="witness-error" role="alert">
      <p><strong>The journey scene could not start.</strong></p>
      <p class="mono">{failure}</p>
      <button class="btn btn-primary" type="button" onclick={finish}>{loop ? "Back" : "Continue to the desk"}</button>
    </div>
  {:else if !ready}<p class="room-loading" role="status">Travelling to {visit?.label ?? visit?.to}…</p>{/if}
  {#if note ?? caption}
    <div class="witness-caption journey-caption" aria-hidden="true"><p class="caption-line">{note ?? caption}</p></div>
  {/if}
  {#if trip}
    <div class="journey-progress" role="progressbar" aria-label="Journey progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={done}>
      <div class="jp-ends"><span>{visit?.from}</span><span>{visit?.label ?? visit?.to}</span></div>
      <div class="jp-track"><span class="jp-fill" style:width="{done}%"></span><span class="jp-marker" style:left="{done}%"></span></div>
      <div class="jp-figures"><span>{done}% of the way</span><span>{secondsLabel(left)} to go · {secondsLabel(Math.max(0, trip.seconds - left))} travelled</span></div>
    </div>
  {/if}
  <p class="sr-only" role="status">{note ?? (loop ? "" : caption) ?? ""}</p>
  <button class="room-skip" type="button" onclick={() => { if (loop || failure || !ready) finish(); else skip(); }}>{loop ? "Back" : "Skip"} <kbd>Esc</kbd></button>
</div>
