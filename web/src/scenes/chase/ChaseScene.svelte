<script lang="ts">
  import { detail } from "../shared/detail.svelte.ts";
  let { seconds, active = true }: { seconds: () => number; active?: boolean } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let error = $state("");
  $effect(() => {
    const target = canvas, reduced = detail.resolved.reducedMotion;
    if (!target || !active) return;
    error = "";
    let cancelled = false;
    let handle: { dispose(): void } | undefined;
    const fault = (cause: unknown) => {
      console.error("The 2D login chase failed.", cause);
      error = "The chase animation is unavailable. You can still sign in.";
    };
    import("./chase-2d.ts").then(({ createChase2d }) => {
      if (!cancelled) handle = createChase2d(target, seconds, reduced, fault);
    }).catch(cause => { if (!cancelled) fault(cause); });
    return () => { cancelled = true; handle?.dispose(); };
  });
</script>

<canvas class="chase" bind:this={canvas} aria-hidden="true"></canvas>
{#if error}<p class="stage-fallback" role="status">{error}</p>{/if}
