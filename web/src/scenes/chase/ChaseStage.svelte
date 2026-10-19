<script lang="ts">
  import ChaseScene from "./ChaseScene.svelte";
  import { MIN_WIDTH } from "../shared/scene-capability.ts";
  import { detail } from "../shared/detail.svelte.ts";
  import { detailKey } from "../shared/detail-level.ts";
  import DetailControl from "../../ui/DetailControl.svelte";
  import type { ChaseHandle } from "./chase3d.ts";
  import { reportSceneFallback } from "../../telemetry.ts";

  let status = $state<"idle" | "loading" | "ready">("idle");
  let failed = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let wide = $state(innerWidth >= MIN_WIDTH);
  const began = performance.now();
  const seconds = () => (performance.now() - began) / 1000;

  // The 3D renderer is an enhancement. It follows the player's picture-detail setting (settings, or the switch below) and is never
  // downloaded on narrow screens (where this panel is hidden), with reduced motion, Save-Data, a slow network or very little memory
  // on Automatic; it falls back to 2D if WebGL fails or runs slowly. It reacts at once if the setting changes.
  const level = $derived(detail.resolved);
  const allowed = $derived(wide && !level.reducedMotion);
  const canvasKey = $derived(detailKey(level));
  const want = $derived(level.renderer === "3d" && allowed && !failed);
  let lastChoice = detail.choice;
  $effect(() => { const c = detail.choice; if (c !== lastChoice) { lastChoice = c; failed = false; } });

  $effect(() => {
    const refresh = () => { wide = innerWidth >= MIN_WIDTH; };
    const query = matchMedia("(min-width: 961px)");
    query.addEventListener("change", refresh);
    addEventListener("resize", refresh);
    return () => { query.removeEventListener("change", refresh); removeEventListener("resize", refresh); };
  });

  $effect(() => {
    const target = canvas;
    const quality = level.quality;
    const models = level.models;
    const key = canvasKey;
    if (!want || !target || target.dataset.key !== key) return;
    let cancelled = false;
    let handle: ChaseHandle | undefined;
    const controller = new AbortController();
    // Wait until the browser is idle so the sign-in form is interactive before the heavy chunk starts downloading.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const timer = idle ? idle(go, { timeout: 2500 }) : window.setTimeout(go, 600);
    function go() {
      if (cancelled) return;
      status = "loading";
      import("./chase3d.ts")
        .then(m => m.createChaseScene(target!, {
          quality,
          models, signal: controller.signal, seconds,
          onSlow: () => { reportSceneFallback("login_chase", "low frame rate"); failed = true; },
          onFault: (why: unknown) => { reportSceneFallback("login_chase", why instanceof Error ? why.message : String(why)); failed = true; }
        }))
        .then(h => { if (cancelled) h.dispose(); else { handle = h; status = "ready"; } })
        .catch(error => { if (!cancelled) { console.error("The login chase could not start; using 2D.", error); failed = true; } });
    }
    return () => {
      cancelled = true;
      controller.abort();
      if (idle) (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(timer); else clearTimeout(timer);
      handle?.dispose(); status = "idle";
    };
  });

</script>

<div class="stage">
  <ChaseScene {seconds} active={wide && status !== "ready"} />
  {#if want}{#key canvasKey}<canvas class="chase3d" class:ready={status === "ready"} data-key={canvasKey} bind:this={canvas} aria-hidden="true"></canvas>{/key}{/if}
  {#if allowed}
    <div class="stage-switch"><DetailControl compact /></div>
    {#if failed}<p class="stage-fallback" role="status">3D is unavailable. Showing the 2D chase.</p>{/if}
  {/if}
</div>
