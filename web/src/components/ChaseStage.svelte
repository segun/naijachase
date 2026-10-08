<script lang="ts">
  import ChaseScene from "./ChaseScene.svelte";
  import { decideScene, readDevice, type SceneDecision } from "../lib/scene-capability.ts";

  type Mode = "3d" | "2d";
  let mode = $state<Mode>(localStorage.getItem("nc-scene") === "2d" ? "2d" : "3d");
  let status = $state<"idle" | "loading" | "ready">("idle");
  let failed = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let device = $state<SceneDecision>(decideScene(readDevice()));

  // The 3D renderer is an enhancement. It is never downloaded on narrow screens (where this panel is hidden), with
  // reduced motion, Save-Data, a slow network or very little memory, and it falls back to 2D if WebGL fails or runs slowly.
  const allowed = $derived(device.run);
  const want = $derived(mode === "3d" && allowed && !failed);

  $effect(() => {
    const refresh = () => { device = decideScene(readDevice()); };
    const query = matchMedia("(min-width: 961px)");
    query.addEventListener("change", refresh);
    addEventListener("resize", refresh);
    return () => { query.removeEventListener("change", refresh); removeEventListener("resize", refresh); };
  });

  $effect(() => {
    const target = canvas;
    const decision = device;
    if (!want || !target || !decision.run) return;
    let cancelled = false;
    let handle: { dispose(): void } | undefined;
    // Wait until the browser is idle so the sign-in form is interactive before the heavy chunk starts downloading.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const timer = idle ? idle(go, { timeout: 2500 }) : window.setTimeout(go, 600);
    function go() {
      if (cancelled) return;
      status = "loading";
      import("../lib/chase3d.ts")
        .then(m => m.createChaseScene(target!, {
          quality: decision.run ? decision.quality : "light",
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

  function choose(next: Mode) {
    mode = next;
    localStorage.setItem("nc-scene", next);
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
