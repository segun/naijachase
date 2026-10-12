<script lang="ts">
  // A small always-available button over the animated scenes to raise or lower the picture detail without leaving the game.
  import { detail } from "../scenes/shared/detail.svelte.ts";
  import { DETAIL_TEXT } from "../scenes/shared/detail-level.ts";
  import DetailControl from "./DetailControl.svelte";

  let open = $state(false);
  let root = $state<HTMLElement>();
  const level = $derived(detail.resolved);

  function away(e: PointerEvent) { if (open && root && !root.contains(e.target as Node)) open = false; }
  function key(e: KeyboardEvent) { if (open && e.key === "Escape") { e.stopPropagation(); open = false; } }
</script>

<svelte:window onpointerdown={away} onkeydowncapture={key} />

<div class="detail-quick" bind:this={root}>
  {#if open}<div class="detail-pop" role="dialog" aria-label="Picture detail"><DetailControl compact /></div>{/if}
  <button class="detail-toggle" type="button" aria-expanded={open} onclick={() => (open = !open)}>
    <span aria-hidden="true">◐</span> Detail: {DETAIL_TEXT[level.level].label}
  </button>
</div>
