<script lang="ts">
  // After the journey: the vehicle pulls up at the venue, the player walks up to the witness and the witness speaks while the words
  // appear along the bottom of the screen as they are said. Its length follows the number of words (see witness-scene.ts).
  //
  import { untrack } from "svelte";
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts } from "../../domain/model.ts";
  import { detail } from "../shared/detail.svelte.ts";
  import { detailKey } from "../shared/detail-level.ts";
  import { recipeFor } from "./venue-recipes.ts";
  import type { WitnessFrame, WitnessHandle } from "./witness-driver.ts";
  import type { Page } from "./witness-scene.ts";
  import { reportSceneFallback } from "../../telemetry.ts";

  type Mode = "3d" | "flat";
  const FALLBACK_KEY = "nc-witness-flat";
  const FIRST_FRAME_MS = 9000;
  const STALL_MS = 3000;

  let { app }: { app: AppController } = $props();

  // The visit is fixed for this scene: the controller keeps it until the scene calls leaveWitness().
  // svelte-ignore state_referenced_locally
  const visit = app.witnessVisit;
  const recipe = visit ? recipeFor(visit.venueId) : undefined;
  const stored = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
  // The picture detail the player chose (or the device allows). It can change at any moment: the scene is rebuilt in the new renderer or
  // detail and carries on from the second it had reached. Failed 3D opens the readable account until the player changes the setting.
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
  let frame = $state<WitnessFrame>({ fade: 0, subtitle: null });
  let words = $state<string[]>([]);
  let pages = $state<Page[]>([]);
  let heard = $state(false);
  let failure = $state("");
  let skip: () => void = () => {};
  let finished = false;
  /** Where 3D picks up after a detail change. */
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

  /** Retain the full account and its Continue action if the animation cannot carry on. */
  function fallBack(at: number, why: string) {
    if (mode !== "3d" || finished) return;
    console.warn(`The 3D witness scene is opening the witness account: ${why}`);
    reportSceneFallback("witness", why);
    try { sessionStorage.setItem(FALLBACK_KEY, "1"); } catch { /* private mode: the next scene just tries 3D again */ }
    resumeAt = at; ready = false; failure = why; broken = true;
  }

  $effect(() => {
    if (!visit || !recipe) { finish(); return; }
    const target = canvas, current = mode, key = canvasKey, { quality, models, reducedMotion } = level;
    if (current === "flat") return;
    // Wait for the replacement canvas when detail changes.
    if (!target || target.dataset.key !== key) return;
    let cancelled = false;
    const controller = new AbortController();
    let handle: WitnessHandle | undefined;
    let began = 0, lastTick = 0;
    // A scene that never draws, or stops drawing, opens the account. A hidden tab is not a stall.
    const watchdog = current === "3d" ? setInterval(() => {
      if (document.hidden) { lastTick = performance.now(); return; }
      if (began && performance.now() - (lastTick || began) > (lastTick ? STALL_MS : FIRST_FRAME_MS)) fallBack(handle?.now() ?? 0, "no frames");
    }, 500) : undefined;
    // The witness is heard over the music, which is turned down while they speak.
    const { sound, preset } = untrack(() => ({ sound: app.music.enabled, preset: app.avatar }));
    if (sound) app.music.duck(true);

    const options = {
      preset, hour, quality, models, signal: controller.signal, recipe, arrival: visit.arrival, text: visit.message, venueName: visit.venueName || "Market", sound, reducedMotion,
      onTick: () => { if (!cancelled) { lastTick = performance.now(); ready = true; } },
      onFrame: (f: WitnessFrame) => { if (!cancelled) { frame = f; if (f.subtitle) heard = true; } },
      onSlow: () => { if (!cancelled) fallBack(handle?.now() ?? 0, "low frame rate"); },
      onFault: (why: string) => { if (!cancelled) fallBack(handle?.now() ?? 0, why); }
    };
    const load = import("./chase3d-witness.ts").then(m => {
      if (cancelled) throw new DOMException("Witness setup cancelled", "AbortError");
      began = performance.now(); return m.createWitnessScene(target, options);
    });

    load
      .then(h => {
        if (cancelled) { h.dispose(); return; }
        handle = h;
        words = h.words; pages = h.pages;
        skip = () => h.skip();
        return h.start(resumeAt || undefined).then(() => { if (!cancelled) finish(); });
      })
      .catch(e => {
        if (cancelled) return;
        console.error(`The ${current} witness scene failed.`, e);
        fallBack(handle?.now() ?? 0, e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true; clearInterval(watchdog);
      if (handle && !finished) resumeAt = handle.now();
      controller.abort();
      handle?.dispose();
      if (sound) app.music.duck(false);
    };
  });

  function key(e: KeyboardEvent) {
    if (!["Escape", "Enter", " "].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== "Escape" && e.target instanceof Element && e.target.closest("button, input, select, textarea, a")) return;
    e.preventDefault();
    if (mode === "flat" || failure || !ready) finish(); else skip();
  }
</script>

<svelte:window onkeydown={key} />

<div class="room witness" role="region" aria-label="Meeting the witness">
  {#if mode === "flat"}
    <section class="witness-account" aria-label="Witness account">
      <p class="caption-who">{visit?.venueName}</p>
      <h1>{visit?.role || "Witness"}</h1>
      {#if failure}<p role="alert">The 3D scene is unavailable. You can still read the witness's full account and continue.</p>{/if}
      {#if failure}<details><summary>Scene details</summary><p>{failure}</p></details>{/if}
      <p class="witness-account-text">{visit?.message}</p>
      <button class="btn btn-primary" type="button" onclick={finish}>Continue to the investigation</button>
    </section>
  {:else}
  {#key canvasKey}<canvas class="room-canvas" class:ready data-mode={mode} data-key={canvasKey} bind:this={canvas} aria-hidden="true"></canvas>{/key}
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
  {/if}
</div>
