<script lang="ts">
  // The shared frame for the full-screen "rooms" (the office and the archive): a lazily loaded 3D scene in which the player's
  // avatar acts out a short intro, ending with the camera zoomed onto a surface (a monitor, a file) where the screen's own
  // content (the children) takes over. The intro plays once per sign-in; after that the content opens straight away over the
  // settled shot. The 3D scene is an enhancement: the content works without it.
  import { untrack, type Snippet } from "svelte";
  import type { SceneHandle, SceneOptions } from "./chase3d-stage.ts";
  import type { AppController } from "../../state/app.svelte";
  import { MIN_WIDTH, decideScene, readDevice } from "./scene-capability.ts";
  import "../../styles/terminal.css";

  let { app, seenKey, load, loading = "Opening the office…", sheet = "crt", quick = false, introFrom = 0, children }: {
    app: AppController;
    /** sessionStorage key marking that this room's intro has played in this sign-in. Without one the intro plays every time. */
    seenKey?: string;
    /** Imports and starts the scene; it must be a dynamic import so Babylon.js stays out of the main bundle. */
    load: (canvas: HTMLCanvasElement, options: SceneOptions) => Promise<SceneHandle>;
    loading?: string;
    /** Play the intro even if this room's intro has already played this sign-in, starting `introFrom` seconds in (the office uses it for the short return from a venue). */
    quick?: boolean;
    introFrom?: number;
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
  // The room is full-screen, so the "narrow viewport" rule that hides the side panel elsewhere does not apply.
  const device = decideScene({ ...readDevice(), viewportWidth: MIN_WIDTH });
  // svelte-ignore state_referenced_locally
  const seen = seenKey !== undefined && sessionStorage.getItem(seenKey) === "1";

  // svelte-ignore state_referenced_locally
  const playIntro = device.run && (!seen || quick);
  let phase = $state<"intro" | "desk" | "outro">(playIntro ? "intro" : "desk");
  let glass = $state(playIntro ? 0 : 1);
  let ready = $state(false);
  let has3d = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let handle: SceneHandle | undefined;
  let lastFrame = 0;

  const awake = $derived(phase !== "intro" || glass > 0.92);

  function finish() {
    if (phase === "desk") return;
    phase = "desk"; glass = 1;
    if (seenKey) sessionStorage.setItem(seenKey, "1");
  }

  function skip() {
    if (handle) handle.skip(); else finish();
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
    if (!target || !device.run) return;
    const intro = untrack(() => phase) === "intro";
    if (intro && !preset) { const timer = setTimeout(finish, AVATAR_WAIT_MS); return () => clearTimeout(timer); }
    let cancelled = false;
    const began = performance.now();
    lastFrame = 0;
    const watchdog = intro ? setInterval(() => {
      if (performance.now() - (lastFrame || began) > (lastFrame ? STALL_MS : FIRST_FRAME_MS)) finish();
    }, 500) : undefined;
    load(target, {
      preset, hour: new Date().getHours(), quality: device.quality,
      // A settled shot (no intro) starts at the end of the timeline.
      startSeconds: intro ? (quick ? introFrom : 0) : 60,
      onGlass: v => {
        if (cancelled) return;
        lastFrame = performance.now(); ready = true;
        if (phase === "intro") { glass = v; if (v >= 1) finish(); } else if (phase === "outro") glass = v;
      },
      onSlow: () => handle?.skip()
    })
      .then(h => { if (cancelled) h.dispose(); else { handle = h; has3d = true; } })
      .catch(e => { console.error("The 3D scene failed; opening the screen instead.", e); if (!cancelled) { has3d = false; finish(); } });
    return () => { cancelled = true; clearInterval(watchdog); handle?.dispose(); handle = undefined; has3d = false; ready = false; };
  });

  function key(e: KeyboardEvent) {
    if (phase === "desk" || !["Escape", "Enter", " "].includes(e.key)) return;
    e.preventDefault();
    skip();
  }
</script>

<svelte:window onkeydown={key} />

<div class="room" class:flat={!has3d}>
  {#if device.run}<canvas class="room-canvas" class:ready bind:this={canvas} aria-hidden="true"></canvas>{/if}
  {#if phase === "intro" && !ready}<p class="room-loading" role="status">{loading}</p>{/if}
  <div class="glass" class:paper={sheet === "paper"} class:dock={sheet === "dock"} style:opacity={glass} style:visibility={glass > 0.01 ? "visible" : "hidden"} inert={phase !== "desk"}>
    {@render children(awake, leave)}
  </div>
  {#if phase !== "desk"}<button class="room-skip" type="button" onclick={skip}>{phase === "intro" ? "Skip intro" : "Skip"} <kbd>Esc</kbd></button>{/if}
</div>
