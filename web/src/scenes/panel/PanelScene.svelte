<script lang="ts">
  // The disciplinary panel. Same pattern as the witness and journey scenes: 3D (Babylon.js) when the device looks capable, otherwise
  // the 2D panel screen (PanelPresentation.svelte), and if 3D fails, stalls or runs too slowly it carries on there from the vote it had
  // reached. Every vote and the decision come from the server; the scene only shows them.
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts } from "../../domain/model.ts";
  import { consequenceLines, offenceLabel, punishmentLabel, tally } from "../../domain/pressure.ts";
  import { MIN_WIDTH, decideScene, readDevice } from "../shared/scene-capability.ts";
  import PanelPresentation from "../../screens/case/PanelPresentation.svelte";
  import { announce, type PanelHandle, type Vote } from "./panel-scene.ts";

  type Mode = "3d" | "2d";
  // The panel keeps its own switch: a failure here must not push the witness or journey scenes to 2D, nor the other way round.
  const FALLBACK_KEY = "nc-panel-2d";
  const FIRST_FRAME_MS = 9000;
  const STALL_MS = 3000;

  let { app }: { app: AppController } = $props();
  // svelte-ignore state_referenced_locally
  const visit = app.panel!;
  const votes = visit.panel.votes as Vote[];
  const decision = decideScene({ ...readDevice(), viewportWidth: MIN_WIDTH });
  const quality = decision.run ? decision.quality : "light";
  const stored = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
  const prefer2d = !decision.run || stored(localStorage, "nc-scene") === "2d" || stored(sessionStorage, FALLBACK_KEY) === "1";

  let mode = $state<Mode>(prefer2d ? "2d" : "3d");
  let canvas = $state<HTMLCanvasElement>();
  let ready = $state(false);
  let fade = $state(0);
  let revealed = $state<(Vote | null)[]>(votes.map(() => null));
  let verdict = $state(false);
  let failure = $state("");
  let skip: () => void = () => {};
  let shownAtFallback = $state(0);
  let card = $state<HTMLElement>();
  // svelte-ignore state_referenced_locally
  const hour = clockParts(app.game?.state.elapsed ?? 0).hour;
  const counted = $derived(tally(votes));
  const lastVote = $derived.by(() => { const n = revealed.filter(v => v !== null).length; return n ? announce(n - 1, revealed[n - 1]!) : ""; });

  function fallBack(at: number, why: string, remember = false) {
    if (mode !== "3d") return;
    console.warn(`The 3D panel scene is switching to 2D: ${why}`);
    if (remember) try { sessionStorage.setItem(FALLBACK_KEY, "1"); } catch { /* private mode: the next scene just tries 3D again */ }
    // Seats arrive first (five steps), then votes: hand over at the same point.
    shownAtFallback = verdict ? Infinity : revealed.filter(v => v !== null).length ? votes.length + revealed.filter(v => v !== null).length : 0;
    void at; ready = false; mode = "2d";
  }

  $effect(() => {
    const target = canvas, current = mode;
    if (current !== "3d" || !target || target.dataset.mode !== current) return;
    let cancelled = false;
    let handle: PanelHandle | undefined;
    let began = 0, lastTick = 0;
    const watchdog = setInterval(() => {
      // Once the verdict is showing the scene has ended and stops drawing on purpose: it must stay until the player accepts.
      if (verdict) return;
      if (document.hidden) { lastTick = performance.now(); return; }
      if (began && performance.now() - (lastTick || began) > (lastTick ? STALL_MS : FIRST_FRAME_MS)) fallBack(handle?.now() ?? 0, "no frames");
    }, 500);

    const options = {
      preset: app.avatar, hour, quality, votes,
      onTick: () => { lastTick = performance.now(); ready = true; },
      onFrame: (f: { fade: number; revealed: (Vote | null)[]; verdict: boolean }) => { fade = f.fade; revealed = f.revealed; verdict = f.verdict; },
      // The scene lasts about ten seconds, so a slow frame rate alone is not worth leaving 3D for; only breakage is.
      onFault: (why: string) => fallBack(handle?.now() ?? 0, why, true)
    };
    import("./chase3d-panel.ts")
      .then(m => { began = performance.now(); return m.createPanelScene3D(target, options); })
      .then(h => {
        if (cancelled) { h.dispose(); return; }
        handle = h;
        skip = () => h.skip();
        return h.start(0);
      })
      .catch(e => {
        if (cancelled) return;
        console.error("The 3D panel scene failed.", e);
        fallBack(handle?.now() ?? 0, e instanceof Error ? e.message : String(e), true);
      });
    return () => { cancelled = true; clearInterval(watchdog); handle?.dispose(); };
  });

  $effect(() => { if (verdict) queueMicrotask(() => card?.focus()); });

  function key(e: KeyboardEvent) {
    if (mode !== "3d" || verdict || !["Escape", "Enter", " "].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    skip();
  }
</script>

<svelte:window onkeydown={key} />

{#if mode === "2d"}
  <PanelPresentation {app} from={shownAtFallback} />
{:else}
  <div class="room witness panel-scene" role="dialog" aria-modal="true" aria-label="Disciplinary panel">
    {#key mode}<canvas class="room-canvas" class:ready data-mode={mode} bind:this={canvas} aria-hidden="true"></canvas>{/key}
    <div class="witness-fade" style:opacity={1 - fade}></div>
    {#if !ready}<p class="room-loading" role="status">The panel is convening…</p>{/if}
    <p class="sr-only" role="status">{lastVote}</p>
    {#if verdict}
      <div class="panel-card" bind:this={card} tabindex="-1" role="status">
        <p class="eyebrow">{offenceLabel(visit.panel.offence)}</p>
        <h2>{visit.panel.decision === "punish" ? "Punished" : "Released with a warning"} · {counted.punish} to {counted.warning}</h2>
        <p>{punishmentLabel(visit.panel.punishment)}.</p>
        <ul>{#each consequenceLines(visit.panel) as line}<li>{line}</li>{/each}</ul>
        <small class="muted">The panel's decision is final. Punishments cannot be bought off.</small>
        <button class="btn btn-primary" type="button" onclick={() => app.dismissPanel()}>{visit.panel.punishment === "jailed" || app.game?.state.outcome ? "Accept judgement and leave" : "Accept judgement and return to the case"}</button>
      </div>
    {:else if ready}
      <button class="room-skip" type="button" onclick={() => skip()}>Skip <kbd>Esc</kbd></button>
    {/if}
  </div>
{/if}
