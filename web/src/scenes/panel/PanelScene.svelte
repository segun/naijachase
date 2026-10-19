<script lang="ts">
  // The disciplinary panel. Same pattern as the witness and journey scenes: 3D (Babylon.js) when the device looks capable, otherwise
  // the 2D panel screen (PanelPresentation.svelte), and if 3D fails, stalls or runs too slowly it carries on there from the vote it had
  // reached. Every vote and the decision come from the server; the scene only shows them.
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts } from "../../domain/model.ts";
  import { consequenceLines, offenceLabel, punishmentLabel, tally } from "../../domain/pressure.ts";
  import { detail } from "../shared/detail.svelte.ts";
  import { detailKey } from "../shared/detail-level.ts";
  import PanelPresentation from "../../screens/case/PanelPresentation.svelte";
  import { announce, planPanel, resumeTime, type PanelHandle, type Vote } from "./panel-scene.ts";
  import { reportSceneFallback } from "../../telemetry.ts";

  type Mode = "3d" | "2d";
  // The panel keeps its own switch: a failure here must not push the witness or journey scenes to 2D, nor the other way round.
  const FALLBACK_KEY = "nc-panel-2d";
  const FIRST_FRAME_MS = 9000;
  const STALL_MS = 3000;

  let { app }: { app: AppController } = $props();
  // svelte-ignore state_referenced_locally
  const visit = app.panel!;
  const votes = visit.panel.votes as Vote[];
  const stored = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
  // The picture detail the player chose (or the device allows). It can change at any moment: the panel is redrawn in the new renderer or
  // detail from the vote it had reached. 3D that failed earlier in this session stays in 2D until the player changes the setting.
  const level = $derived(detail.resolved);
  let broken = $state(stored(sessionStorage, FALLBACK_KEY) === "1");
  const mode = $derived<Mode>(level.renderer === "3d" && !broken ? "3d" : "2d");
  const canvasKey = $derived(mode === "3d" ? detailKey(level) : "2d");
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
  let revealed = $state<(Vote | null)[]>(votes.map(() => null));
  let verdict = $state(false);
  let failure = $state("");
  let skip: () => void = () => {};
  /** Steps the 2D panel has shown (five seats, then the votes), reported by the 2D panel. */
  let shown2d = 0;
  let card = $state<HTMLElement>();
  // svelte-ignore state_referenced_locally
  const hour = clockParts(app.game?.state.elapsed ?? 0).hour;
  const counted = $derived(tally(votes));
  // Where the 2D panel picks up when 3D hands over: seats arrive first (five steps), then votes.
  const revealedCount = $derived(revealed.filter(v => v !== null).length);
  const shownAtFallback = $derived(verdict ? Infinity : revealedCount ? votes.length + revealedCount : 0);
  const lastVote = $derived.by(() => { const n = revealed.filter(v => v !== null).length; return n ? announce(n - 1, revealed[n - 1]!) : ""; });

  function fallBack(why: string, remember = false) {
    if (mode !== "3d") return;
    console.warn(`The 3D panel scene is switching to 2D: ${why}`);
    reportSceneFallback("disciplinary_panel", why);
    if (remember) try { sessionStorage.setItem(FALLBACK_KEY, "1"); } catch { /* private mode: the next scene just tries 3D again */ }
    ready = false; broken = true;
  }

  $effect(() => {
    const target = canvas, key = canvasKey, { quality, models } = level;
    if (mode !== "3d" || !target || target.dataset.key !== key) return;
    let cancelled = false;
    const controller = new AbortController();
    let handle: PanelHandle | undefined;
    let began = 0, lastTick = 0;
    const watchdog = setInterval(() => {
      // Once the verdict is showing the scene has ended and stops drawing on purpose: it must stay until the player accepts.
      if (verdict) return;
      if (document.hidden) { lastTick = performance.now(); return; }
      if (began && performance.now() - (lastTick || began) > (lastTick ? STALL_MS : FIRST_FRAME_MS)) fallBack("no frames");
    }, 500);

    const options = {
      preset: app.avatar, hour, quality, models, votes, signal: controller.signal,
      onTick: () => { lastTick = performance.now(); ready = true; },
      onFrame: (f: { fade: number; revealed: (Vote | null)[]; verdict: boolean }) => { fade = f.fade; revealed = f.revealed; verdict = f.verdict; },
      // The scene lasts about ten seconds, so a slow frame rate alone is not worth leaving 3D for; only breakage is.
      onFault: (why: string) => fallBack(why, true)
    };
    import("./chase3d-panel.ts")
      .then(m => { began = performance.now(); return m.createPanelScene3D(target, options); })
      .then(h => {
        if (cancelled) { h.dispose(); return; }
        handle = h;
        skip = () => h.skip();
        // Raised from 2D part-way through: carry on from the vote the 2D panel had reached.
        return h.start(shown2d > 0 ? resumeTime(planPanel(votes), Math.max(0, shown2d - votes.length)) : 0);
      })
      .catch(e => {
        if (cancelled) return;
        console.error("The 3D panel scene failed.", e);
        fallBack(e instanceof Error ? e.message : String(e), true);
      });
    return () => { cancelled = true; controller.abort(); clearInterval(watchdog); handle?.dispose(); };
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
  <PanelPresentation {app} from={shownAtFallback} onProgress={n => { shown2d = n; }} />
{:else}
  <div class="room witness panel-scene" role="dialog" aria-modal="true" aria-label="Disciplinary panel">
    {#key canvasKey}<canvas class="room-canvas" class:ready data-mode={mode} data-key={canvasKey} bind:this={canvas} aria-hidden="true"></canvas>{/key}
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
