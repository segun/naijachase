<script lang="ts">
  import { MAP_H, MAP_W, outlinePath, statePoint } from "../map.ts";
  import { STATES } from "../model.ts";

  const route = ["Lagos", "Oyo", "Kogi", "Federal Capital Territory", "Kaduna", "Kano"];
  const points = route.map(s => statePoint(s)!);
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(0)} ${p.y.toFixed(0)}`).join(" ");
</script>

<svg class="nigeria-art" viewBox="0 0 {MAP_W} {MAP_H}" role="img" aria-label="Stylised map of Nigeria with a detective's route from Lagos to Kano">
  <defs>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14543f" /><stop offset="1" stop-color="#0a2d22" />
    </linearGradient>
    <pattern id="ankara" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="13" cy="13" r="2" fill="#2bd985" fill-opacity=".18" />
      <circle cx="0" cy="0" r="2" fill="#f2c14e" fill-opacity=".14" /><circle cx="26" cy="26" r="2" fill="#f2c14e" fill-opacity=".14" />
    </pattern>
  </defs>
  <path d={outlinePath()} fill="url(#land)" stroke="#2bd985" stroke-opacity=".6" stroke-width="3" stroke-linejoin="round" />
  <path d={outlinePath()} fill="url(#ankara)" />
  {#each STATES as s}{@const p = statePoint(s)!}<circle cx={p.x} cy={p.y} r="5" fill="#a4bdb0" fill-opacity=".55" />{/each}
  <path class="route" d={path} fill="none" stroke="#f2c14e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 16" />
  {#each points as p, i}
    <circle class="ping" cx={p.x} cy={p.y} r="22" fill="#f2c14e" fill-opacity=".25" style:animation-delay="{i * 0.35}s" />
    <circle cx={p.x} cy={p.y} r="9" fill="#f2c14e" stroke="#04100c" stroke-width="3" />
  {/each}
</svg>
