<script lang="ts">
  // The shared frame for the full-screen "rooms" (the office and the archive): a lazily loaded 3D scene in which the player's
  // avatar acts out a short intro, ending with the camera zoomed onto a surface (a monitor, a file) where the screen's own
  // content (the children) takes over. Optional office exploration pauses before that zoom on every entry; other rooms keep
  // the once-per-sign-in intro. The 3D scene is an enhancement: the content works without it.
  import { untrack, type Snippet } from "svelte";
  import type { SceneHandle, SceneOptions } from "./chase3d-stage.ts";
  import type { AppController } from "../../state/app.svelte";
  import { detail } from "./detail.svelte.ts";
  import { detailKey } from "./detail-level.ts";
  import "../../styles/terminal.css";

  let { app, seenKey, load, loading = "Opening the office…", sheet = "crt", quick = false, introFrom = 0, exploreAt, children }: {
    app: AppController;
    /** sessionStorage key marking that this room's intro has played in this sign-in. Without one the intro plays every time. */
    seenKey?: string;
    /** Imports and starts the scene; it must be a dynamic import so Babylon.js stays out of the main bundle. */
    load: (canvas: HTMLCanvasElement, options: SceneOptions) => Promise<SceneHandle>;
    loading?: string;
    /** Play the intro even if this room's intro has already played this sign-in, starting `introFrom` seconds in (the office uses it for the short return from a venue). */
    quick?: boolean;
    introFrom?: number;
    exploreAt?: number;
    /** The look of the surface the camera lands on; a dock is a panel along the bottom over the settled shot, with no zoom. */
    sheet?: "crt" | "paper" | "dock";
    /** Receives whether the screen is awake, and `leave`, which plays the scene's exit animation (the player walking out) and resolves when it ends. */
    children: Snippet<[boolean, (how?: string) => Promise<void>]>;
  } = $props();

  const AVATAR_WAIT_MS = 8000;
  // If the scene never draws its first frame (a hidden tab, a stalled GPU) or stops advancing, hand over to the terminal.
  const FIRST_FRAME_MS = 7000;
  const STALL_MS = 3000;
  /** Leaving must never hang the screen: if the exit animation has not ended by now, carry on. */
  const LEAVE_MAX_MS = 6000;
  // The picture detail the player chose (or the device allows). It can change at any moment; the scene is then rebuilt where it had got to.
  // A change during the exit animation waits: the room is about to be left anyway.
  // svelte-ignore state_referenced_locally
  let applied = $state(detail.resolved);
  const wants3d = $derived(applied.renderer === "3d");
  // svelte-ignore state_referenced_locally
  const seen = seenKey !== undefined && sessionStorage.getItem(seenKey) === "1";

  // svelte-ignore state_referenced_locally
  const playIntro = detail.resolved.renderer === "3d" && (!seen || quick || exploreAt !== undefined);
  // svelte-ignore state_referenced_locally
  let phase = $state<"intro" | "look" | "desk" | "outro">(playIntro ? "intro" : exploreAt !== undefined ? "look" : "desk");
  // svelte-ignore state_referenced_locally
  let glass = $state(playIntro || exploreAt !== undefined ? 0 : 1);
  let ready = $state(false);
  let has3d = $state(false);
  let failed = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let handle: SceneHandle | undefined;
  let lastFrame = 0;
  /** Where the intro had got to when the scene was last rebuilt (a detail change mid-intro), so it carries on from there. */
  let resume = 0;
  let continued = false;
  let lookX = 0, lookY = 0;
  let dragging: number | undefined;
  let pointerX = 0, pointerY = 0;

  $effect(() => { const next = detail.resolved; if (untrack(() => phase) !== "outro") applied = next; });
  // Dropping to the simple level mid-intro opens the screen straight away instead of waiting for a scene that is no longer drawn.
  $effect(() => { if (!wants3d && (phase === "intro" || phase === "look")) fallback(); });

  const awake = $derived(phase === "desk" || phase === "outro" || glass > 0.92);

  function finish() {
    if (phase === "desk") return;
    phase = "desk"; glass = 1;
    if (seenKey) sessionStorage.setItem(seenKey, "1");
  }

  function skip() {
    if (handle) handle.skip(); else finish();
  }

  function fallback() {
    if (exploreAt !== undefined && !continued) { phase = "look"; glass = 0; }
    else finish();
  }

  function continueToDesk() {
    if (phase !== "look") return;
    continued = true; lookX = 0; lookY = 0;
    if (handle?.continue && wants3d && ready) { lastFrame = performance.now(); phase = "intro"; handle.continue(); }
    else finish();
  }

  function look(dx: number, dy: number) {
    if (phase !== "look" || !ready) return;
    const x = Math.max(-0.7, Math.min(0.7, lookX + dx));
    const y = Math.max(-0.3, Math.min(0.4, lookY + dy));
    handle?.look?.(x - lookX, y - lookY);
    lookX = x; lookY = y;
  }

  function pointerDown(e: PointerEvent) {
    if (phase !== "look" || !ready || e.button !== 0) return;
    dragging = e.pointerId; pointerX = e.clientX; pointerY = e.clientY;
    canvas?.setPointerCapture(e.pointerId);
  }

  function pointerMove(e: PointerEvent) {
    if (dragging !== e.pointerId) return;
    look((pointerX - e.clientX) * 0.004, (e.clientY - pointerY) * 0.003);
    pointerX = e.clientX; pointerY = e.clientY;
  }

  function pointerUp(e: PointerEvent) {
    if (dragging !== e.pointerId) return;
    dragging = undefined;
    if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  }

  /** The exit: the glass fades, the camera pulls back and the player walks out. Without a 3D scene it is a quick fade. */
  async function leave(how?: string) {
    if (phase !== "desk") return;
    phase = "outro";
    const exit = handle?.leave;
    if (exit) await Promise.race([exit(how), new Promise(resolve => setTimeout(resolve, LEAVE_MAX_MS))]);
    else { glass = 0; await new Promise(resolve => setTimeout(resolve, 250)); }
  }

  // The room needs the player's avatar; if it never arrives the terminal simply opens without the walk-in.
  $effect(() => {
    const target = canvas;
    const preset = app.avatar;
    const level = applied;
    if (!target || level.renderer !== "3d" || target.dataset.key !== detailKey(level)) return;
    const currentPhase = untrack(() => phase);
    const intro = currentPhase === "intro";
    const looking = currentPhase === "look";
    if ((intro || looking) && !preset) { const timer = setTimeout(fallback, AVATAR_WAIT_MS); return () => clearTimeout(timer); }
    let cancelled = false;
    const controller = new AbortController();
    const began = performance.now();
    lastFrame = 0;
    const watchdog = intro || looking ? setInterval(() => {
      if (untrack(() => phase) === "look" && lastFrame) return;
      if (performance.now() - (lastFrame || began) > (lastFrame ? STALL_MS : FIRST_FRAME_MS)) { failed = true; fallback(); }
    }, 500) : undefined;
    load(target, {
      signal: controller.signal,
      exploreAt: continued ? undefined : exploreAt,
      onExplore: () => { if (!cancelled && !continued) { phase = "look"; glass = 0; } },
      preset, hour: new Date().getHours(), quality: level.quality, models: level.models,
      // A settled shot (no intro) starts at the end of the timeline.
      startSeconds: looking ? exploreAt : intro ? (resume || (quick ? introFrom : seen && exploreAt !== undefined ? exploreAt : 0)) : 60,
      onGlass: v => {
        if (cancelled) return;
        lastFrame = performance.now(); ready = true;
        if (phase === "intro") { glass = v; if (v >= 1) finish(); } else if (phase === "outro") glass = v;
      },
      onSlow: () => handle?.skip()
    })
      .then(h => { if (cancelled) h.dispose(); else { handle = h; has3d = true; if (looking) h.look?.(lookX, lookY); } })
      .catch(e => { if (cancelled) return; console.error("The 3D scene failed; opening the screen instead.", e); has3d = false; failed = true; fallback(); });
    return () => {
      cancelled = true; clearInterval(watchdog);
      if ((intro || looking) && handle) resume = handle.now();
      dragging = undefined;
      controller.abort();
      handle?.dispose(); handle = undefined; has3d = false; ready = false; failed = false;
    };
  });

  function key(e: KeyboardEvent) {
    if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("input, textarea, select, [role=dialog]"))) return;
    if (e.target instanceof Element && e.target.closest("button") && ["Enter", " "].includes(e.key)) return;
    if (phase === "look") {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        look(e.key === "ArrowLeft" ? -0.08 : e.key === "ArrowRight" ? 0.08 : 0, e.key === "ArrowUp" ? 0.05 : e.key === "ArrowDown" ? -0.05 : 0);
      } else if (["Enter", " "].includes(e.key)) { e.preventDefault(); continueToDesk(); }
      return;
    }
    if (phase === "desk" || !["Escape", "Enter", " "].includes(e.key)) return;
    e.preventDefault();
    skip();
  }
</script>

<svelte:window onkeydown={key} />

<div class="room" class:flat={!has3d}>
  {#if wants3d}{#key detailKey(applied)}<canvas class="room-canvas" class:ready data-key={detailKey(applied)} bind:this={canvas} aria-hidden="true" onpointerdown={pointerDown} onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={pointerUp}></canvas>{/key}{/if}
  {#if phase === "intro" && !ready}<p class="room-loading" role="status">{loading}</p>{/if}
  <div class="glass" class:paper={sheet === "paper"} class:dock={sheet === "dock"} style:opacity={glass} style:visibility={glass > 0.01 ? "visible" : "hidden"} inert={phase !== "desk"}>
    {@render children(awake, leave)}
  </div>
  {#if phase === "look"}
    <section class="room-look" class:room-look-unavailable={!wants3d} aria-label="Look around the office">
      {#if !wants3d}
        <div role="alert">
          <p>Look around is unavailable in Simple mode</p>
          <span>Switch to Standard or Full to look around the office, or continue straight to the case desk.</span>
        </div>
      {:else}
        <p role="status">Look around the office</p>
        <span>{failed ? "The office camera is unavailable. You can still continue to the case desk." : ready ? "Drag or swipe the scene, or use the arrow keys." : "Preparing the office view..."}</span>
      {/if}
      <div class="room-look-actions">
        {#if !wants3d}<button type="button" onclick={() => detail.set("standard")}>Use Standard detail</button>{/if}
        <button type="button" onclick={continueToDesk}>Continue to case desk</button>
      </div>
    </section>
  {:else if phase !== "desk"}<button class="room-skip" type="button" onclick={skip}>{phase === "intro" ? "Skip intro" : "Skip"} <kbd>Esc</kbd></button>{/if}
</div>
