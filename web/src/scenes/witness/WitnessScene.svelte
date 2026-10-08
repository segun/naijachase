<script lang="ts">
  // After the journey: the vehicle pulls up at the venue, the player walks up to the witness and the witness speaks while the words
  // appear along the bottom of the screen as they are said. Its length follows the number of words (see witness-scene.ts).
  //
  // THE 3D / 2D PATTERN (follow it for every scene): the scene is never skipped for being hard to render. It starts in 3D (Babylon.js)
  // when the device looks capable and otherwise in 2D (Canvas 2D, witness-2d.ts), and if 3D then fails to start, stalls or runs too
  // slowly it carries on in 2D from where it had got to. Both renderers take the same options, return the same handle and read the same
  // timeline (witness-scene.ts), so they show the same events and cost the same time. Only if 2D also fails is the reason shown.
  import { untrack } from "svelte";
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts } from "../../domain/model.ts";
  import { MIN_WIDTH, decideScene, readDevice } from "../shared/scene-capability.ts";
  import { recipeFor } from "./venue-recipes.ts";
  import type { WitnessFrame, WitnessHandle } from "./witness-driver.ts";
  import type { Page } from "./witness-scene.ts";

  type Mode = "3d" | "2d";
  /** Set once 3D has failed on this device in this session, so later scenes go straight to 2D instead of failing again. */
  const FALLBACK_KEY = "nc-witness-2d";
  /** If 3D never draws its first frame, or stops advancing, for this long (ms) we carry on in 2D. */
  const FIRST_FRAME_MS = 9000;
  const STALL_MS = 3000;

  let { app }: { app: AppController } = $props();

  // The visit is fixed for this scene: the controller keeps it until the scene calls leaveWitness().
  // svelte-ignore state_referenced_locally
  const visit = app.witnessVisit;
  const recipe = visit ? recipeFor(visit.venueId) : undefined;
  // The scene is full-screen, so the "narrow viewport" rule that hides the side panel elsewhere does not apply.
  const decision = decideScene({ ...readDevice(), viewportWidth: MIN_WIDTH });
  const quality = decision.run ? decision.quality : "light";
  const reducedMotion = !decision.run && decision.reason === "reduced-motion";
  const stored = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
  // "nc-scene" = "2d" is the player's own choice (the same switch the sign-in scene uses) and can be set to test 2D.
  const prefer2d = !decision.run || stored(localStorage, "nc-scene") === "2d" || stored(sessionStorage, FALLBACK_KEY) === "1";

  let mode = $state<Mode>(prefer2d ? "2d" : "3d");
  let canvas = $state<HTMLCanvasElement>();
  let ready = $state(false);
  let frame = $state<WitnessFrame>({ fade: 0, subtitle: null });
  let words = $state<string[]>([]);
  let pages = $state<Page[]>([]);
  let heard = $state(false);
  let failure = $state("");
  let skip: () => void = () => {};
  let finished = false;
  /** Where 2D picks up if 3D hands over part-way through. */
  let resumeAt = 0;

  const page = $derived(frame.subtitle ? pages[frame.subtitle.page] : undefined);
  // The lighting follows the case clock, not the player's own clock.
  // svelte-ignore state_referenced_locally
  const hour = clockParts(app.game?.state.elapsed ?? 0).hour;

  function finish() {
    if (finished) return;
    finished = true;
    app.leaveWitness();
  }

  /** 3D could not carry on: continue in 2D from `at` seconds, and remember it for the next scene. */
  function fallBack(at: number, why: string) {
    if (mode !== "3d" || finished) return;
    console.warn(`The 3D witness scene is switching to 2D: ${why}`);
    try { sessionStorage.setItem(FALLBACK_KEY, "1"); } catch { /* private mode: the next scene just tries 3D again */ }
    resumeAt = at; ready = false; mode = "2d";
  }

  $effect(() => {
    if (!visit || !recipe) { finish(); return; }
    const target = canvas, current = mode;
    // The canvas is replaced when the mode changes (a canvas cannot switch from WebGL to 2D), so wait for the matching one.
    if (!target || target.dataset.mode !== current) return;
    let cancelled = false;
    let handle: WitnessHandle | undefined;
    let began = 0, lastTick = 0;
    // 3D only: a scene that never draws, or stops drawing, hands over to 2D. A hidden tab is not a stall.
    const watchdog = current === "3d" ? setInterval(() => {
      if (document.hidden) { lastTick = performance.now(); return; }
      if (began && performance.now() - (lastTick || began) > (lastTick ? STALL_MS : FIRST_FRAME_MS)) fallBack(handle?.now() ?? 0, "no frames");
    }, 500) : undefined;
    // The witness is heard over the music, which is turned down while they speak.
    const { sound, preset } = untrack(() => ({ sound: app.music.enabled, preset: app.avatar }));
    if (sound) app.music.duck(true);

    const options = {
      preset, hour, quality, recipe, arrival: visit.arrival, text: visit.message, venueName: visit.venueName || "Market", sound, reducedMotion,
      onTick: () => { lastTick = performance.now(); ready = true; },
      onFrame: (f: WitnessFrame) => { frame = f; if (f.subtitle) heard = true; },
      onSlow: () => fallBack(handle?.now() ?? 0, "low frame rate"),
      onFault: (why: string) => { if (current === "3d") fallBack(handle?.now() ?? 0, why); else failure = why; }
    };
    const load = current === "3d"
      ? import("./chase3d-witness.ts").then(m => { began = performance.now(); return m.createWitnessScene(target, options); })
      : import("./witness-2d.ts").then(m => m.createWitnessScene2D(target, options));

    load
      .then(h => {
        if (cancelled) { h.dispose(); return; }
        handle = h;
        words = h.words; pages = h.pages;
        skip = () => h.skip();
        return h.start(current === "2d" ? resumeAt : 0).then(() => { if (!cancelled) finish(); });
      })
      .catch(e => {
        if (cancelled) return;
        console.error(`The ${current} witness scene failed.`, e);
        if (current === "3d") fallBack(handle?.now() ?? 0, e instanceof Error ? e.message : String(e));
        else failure = e instanceof Error ? e.message : String(e);
      });

    return () => {
      cancelled = true; clearInterval(watchdog); handle?.dispose();
      if (sound) app.music.duck(false);
    };
  });

  function key(e: KeyboardEvent) {
    if (!["Escape", "Enter", " "].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (failure || !ready) finish(); else skip();
  }
</script>

<svelte:window onkeydown={key} />

<div class="room witness" role="region" aria-label="Meeting the witness">
  {#key mode}<canvas class="room-canvas" class:ready data-mode={mode} bind:this={canvas} aria-hidden="true"></canvas>{/key}
  <div class="witness-fade" style:opacity={1 - frame.fade}></div>
  {#if failure}
    <div class="witness-error" role="alert">
      <p><strong>The witness scene could not start.</strong></p>
      <p class="mono">{failure}</p>
      <button class="btn btn-primary" type="button" onclick={finish}>Continue to the investigation</button>
    </div>
  {:else if !ready}<p class="room-loading" role="status">Heading to the {visit?.venueName ? "venue" : "witness"}…</p>{/if}
  {#if page && frame.subtitle}
    <div class="witness-caption" aria-hidden="true">
      {#if visit?.role}<p class="caption-who">{visit.role}</p>{/if}
      <p class="caption-line">
        {#each words.slice(page.from, page.to) as word, i}<span class:said={page.from + i < frame.subtitle.spoken} class:now={page.from + i === frame.subtitle.spoken - 1}>{word}</span>{" "}{/each}
      </p>
    </div>
  {/if}
  <!-- Screen readers get the whole account once, when the witness starts to speak, instead of one word at a time. -->
  <p class="sr-only" role="status">{#if heard && visit}{visit.role}: {visit.message}{/if}</p>
  <button class="room-skip" type="button" onclick={() => { if (failure || !ready) finish(); else skip(); }}>Skip <kbd>Esc</kbd></button>
</div>
