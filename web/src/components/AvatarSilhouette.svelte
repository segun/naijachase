<script lang="ts">
  // The no-WebGL / performance-mode look: the same preset fields drawn as flat SVG shapes. Decorative; text carries the meaning.
  import { bodyShapes, hairShapes, tintColor, type AvatarPreset, type Shape } from "../lib/avatar-model.ts";

  let { preset, crop = "full" }: { preset: AvatarPreset; crop?: "full" | "bust" } = $props();
  const body = $derived(bodyShapes(preset));
  const hair = $derived(hairShapes(preset.hair_style));
  const fill = (s: Shape) => tintColor(preset, s.tint);
</script>

{#snippet draw(shapes: Shape[])}
  {#each shapes as s}
    {#if s.kind === "ellipse"}<ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill(s)} />
    {:else}<rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={fill(s)} />{/if}
  {/each}
{/snippet}

<svg class="silhouette" viewBox={crop === "bust" ? "16 10 88 88" : "0 0 120 200"} aria-hidden="true" focusable="false">
  {@render draw(hair.back)}
  {@render draw(body.before)}
  {@render draw([body.head])}
  {@render draw(body.after)}
  {@render draw(hair.front)}
</svg>
