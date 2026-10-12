<script lang="ts">
  import ChaseScene from "./ChaseScene.svelte";
  import { MIN_WIDTH } from "../shared/scene-capability.ts";
  import { detail } from "../shared/detail.svelte.ts";
  import { resolveDetail } from "../shared/detail-level.ts";

  let status = $state<"idle" | "loading" | "ready">("idle");
  let failed = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let wide = $state(innerWidth >= MIN_WIDTH);

  // The 3D renderer is an enhancement. It follows the player's picture-detail setting (settings, or the switch below) and is never
  // downloaded on narrow screens (where this panel is hidden), with reduced motion, Save-Data, a slow network or very little memory
  // on Automatic; it falls back to 2D if WebGL fails or runs slowly. It reacts at once if the setting changes.
  const level = $derived(detail.resolved);
  const allowed = $derived(wide && !level.reducedMotion);
  const mode = $derived(level.renderer);
  const want = $derived(mode === "3d" && allowed && !failed);
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
    if (!want || !target) return;
    let cancelled = false;
    let handle: { dispose(): void } | undefined;
    // Wait until the browser is idle so the sign-in form is interactive before the heavy chunk starts downloading.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const timer = idle ? idle(go, { timeout: 2500 }) : window.setTimeout(go, 600);
    function go() {
      if (cancelled) return;
      status = "loading";
      import("./chase3d.ts")
        .then(m => m.createChaseScene(target!, {
          quality,
          onSlow: () => { failed = true; }
        }))
        .then(h => { if (cancelled) h.dispose(); else { handle = h; status = "ready"; } })
        .catch(() => { if (!cancelled) failed = true; });
    }
    return () => {
      cancelled = true;
      if (idle) (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(timer); else clearTimeout(timer);
      handle?.dispose(); status = "idle";
    };
  });

  function choose(next: "3d" | "2d") {
    if (next === "2d") { detail.set("simple"); return; }
    if (level.renderer === "3d") return;
    // Asked for 3D: Automatic if it would give 3D here, otherwise the lighter 3D level.
    detail.set(resolveDetail("auto", detail.device).renderer === "3d" ? "auto" : "standard");
  }
</script>

<div class="stage">
  <ChaseScene />
  {#if want}<canvas class="chase3d" class:ready={status === "ready"} bind:this={canvas} aria-hidden="true"></canvas>{/if}
  {#if allowed && !failed}
    <div class="stage-switch segmented" role="group" aria-label="Scene view">
      <button type="button" aria-pressed={mode === "3d"} onclick={() => choose("3d")}>3D</button>
      <button type="button" aria-pressed={mode === "2d"} onclick={() => choose("2d")}>2D</button>
    </div>
  {/if}
</div>
