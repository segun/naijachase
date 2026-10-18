<script lang="ts">
  // The picture-detail switch (see scenes/shared/detail-level.ts). It acts at once: scenes that are playing rebuild at the new level and carry on.
  import { detail } from "../scenes/shared/detail.svelte.ts";
  import { CHOICES, DETAIL_TEXT } from "../scenes/shared/detail-level.ts";

  let { compact = false }: { compact?: boolean } = $props();
</script>

<div class="detail-control" class:compact>
  <div class="segmented" role="group" aria-label="Picture detail">
    {#each CHOICES as choice}
      <button type="button" aria-pressed={detail.choice === choice} title={DETAIL_TEXT[choice].summary} onclick={() => detail.set(choice)}>{DETAIL_TEXT[choice].label}</button>
    {/each}
  </div>
  {#if !compact}
    <ul class="detail-help">
      {#each CHOICES as choice}<li><strong>{DETAIL_TEXT[choice].label}</strong>: {DETAIL_TEXT[choice].summary}</li>{/each}
    </ul>
    <p class="muted">Lower levels download less and use less battery. You can change this at any time, even while a scene is playing. Full is the only level that downloads the 3D model files.</p>
  {/if}
</div>
