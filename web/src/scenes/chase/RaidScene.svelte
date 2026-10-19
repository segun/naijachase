<script lang="ts">
  // The hideout raid: a few seconds of the login chase. The suspect outruns the officers when they are not at the hideout and is
  // caught when they are (raid-scene.ts). 3D when the device allows it, the 2D chase otherwise or if 3D fails (it carries on from
  // the same second), and the captions alone with reduced motion.
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import "../../styles/raid.css";
  import type { AppController } from "../../state/app.svelte";
  import { detail } from "../shared/detail.svelte.ts";
  import { detailKey } from "../shared/detail-level.ts";
  import { RAID_SECONDS, raidFrame, raidLineAt, raidLines, raidStart } from "./raid-scene.ts";
  import type { ChaseHandle } from "./chase3d.ts";
  import { reportSceneFallback } from "../../telemetry.ts";

  const FIRST_FRAME_MS = 9000;

  let { app }: { app: AppController } = $props();

  // The raid is fixed for this scene: the controller keeps it until the scene calls leaveRaid().
  // svelte-ignore state_referenced_locally
  const visit = app.raidVisit;
  const ending = visit?.ending ?? "escape";
  const length = RAID_SECONDS[ending];
  const start = raidStart(visit?.state ?? "");
  const lines = raidLines(ending, visit?.suspect ?? "", visit?.seed ?? 0, visit?.finale);
  const frame = (s: number) => raidFrame(s, ending, start);

  const level = $derived(detail.resolved);
  let broken = $state(false);
  let flatFailed = $state(false);
  const mode = $derived<"3d" | "2d" | "text">(level.reducedMotion || flatFailed ? "text" : level.renderer === "3d" && !broken ? "3d" : "2d");
  const canvasKey = $derived(mode === "3d" ? detailKey(level) : mode);
  let lastChoice = detail.choice;
  $effect(() => { const c = detail.choice; if (c !== lastChoice) { lastChoice = c; broken = false; } });

  let canvas = $state<HTMLCanvasElement>();
  let ready = $state(false);
  let now = $state(0);
  let finished = false;
  // The raid's own clock starts with the first picture, so loading never eats into it, and survives a change of renderer.
  let startedAt: number | null = null;
  const seconds = () => (startedAt === null ? 0 : Math.min(length, (performance.now() - startedAt) / 1000));
  const begin = () => { if (startedAt === null) startedAt = performance.now(); ready = true; };
  const line = $derived(raidLineAt(lines, now));

  function finish() {
    if (finished) return;
    finished = true;
    app.leaveRaid();
  }

  $effect(() => {
    if (!visit) { finish(); return; }
    if (mode === "text") return;
    let raf = 0;
    const tick = () => {
      now = seconds();
      if (startedAt !== null && now >= length) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    const target = canvas, current = mode, key = canvasKey, { quality, models } = level;
    if (current === "text" || !target || target.dataset.key !== key) return;
    let cancelled = false;
    let handle: { dispose(): void } | undefined;
    ready = false;
    if (current === "2d") {
      const fault = (cause: unknown) => { console.error("The 2D raid failed.", cause); if (!cancelled) flatFailed = true; };
      import("./chase-2d.ts")
        .then(({ createChase2d }) => {
          if (cancelled) return;
          handle = createChase2d(target, seconds, false, fault, frame);
          begin();
        })
        .catch(fault);
      return () => { cancelled = true; handle?.dispose(); };
    }
    const controller = new AbortController();
    const fallBack = (why: unknown) => { if (cancelled) return; const reason = why instanceof Error ? why.message : String(why); console.warn("The 3D raid is continuing in 2D:", why); reportSceneFallback("raid", reason); broken = true; };
    const watchdog = setTimeout(() => { if (!ready) fallBack("no frames"); }, FIRST_FRAME_MS);
    import("./chase3d.ts")
      .then(m => m.createChaseScene(target, {
        quality, models, signal: controller.signal, seconds, frame,
        onTick: () => { if (!cancelled && !ready) begin(); },
        onSlow: () => fallBack("low frame rate"),
        onFault: (e: unknown) => fallBack(e)
      }))
      .then((h: ChaseHandle) => { if (cancelled) h.dispose(); else handle = h; })
      .catch(fallBack);
    return () => { cancelled = true; clearTimeout(watchdog); controller.abort(); handle?.dispose(); };
  });

  function key(e: KeyboardEvent) {
    if (!["Escape", "Enter", " "].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== "Escape" && e.target instanceof Element && e.target.closest("button, input, select, textarea, a")) return;
    e.preventDefault();
    finish();
  }
</script>

<svelte:window onkeydown={key} />

<div class="room raid" role="region" aria-label="Raiding the {visit?.label.toLowerCase() ?? 'hideout'}">
  {#if mode === "text"}
    <section class="witness-account" aria-label="Raid">
      <p class="caption-who">Raid · {visit?.label}</p>
      <h1>{ending === "catch" ? "Caught!" : "Not here"}</h1>
      {#each lines as l}<p class="witness-account-text">{l.text}</p>{/each}
      <button class="btn btn-primary" type="button" onclick={finish}>Continue</button>
    </section>
  {:else}
    {#key canvasKey}<canvas class="room-canvas" class:ready data-key={canvasKey} bind:this={canvas} aria-hidden="true"></canvas>{/key}
    {#if !ready}<p class="room-loading" role="status">Raiding the {visit?.label.toLowerCase() ?? "hideout"}…</p>{/if}
    {#if ready && line}
      <div class="witness-caption raid-caption" aria-hidden="true">
        <p class="caption-who">Raid · {visit?.label}</p>
        {#key line.text}<p class="caption-line">{line.text}</p>{/key}
      </div>
    {/if}
    <!-- Screen readers hear the whole raid once, when it starts, instead of a caption at a time. -->
    <p class="sr-only" role="status">{#if ready}{lines.map(l => l.text).join(" ")}{/if}</p>
    <button class="room-skip" type="button" onclick={finish}>Skip <kbd>Esc</kbd></button>
  {/if}
</div>
