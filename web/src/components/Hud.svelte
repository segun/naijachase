<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { clockParts, dayPart, timeLeft, zoneOf } from "../model.ts";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
  const parts = $derived(clockParts(gs.elapsed));
  const left = $derived(timeLeft(gs.elapsed));
  const night = $derived(dayPart(parts.hour) === "night");
</script>

<section class="hud" aria-label="Case status">
  <div class="hud-item">
    <Icon name="pin" />
    <div><span class="hud-label">Location</span><span class="hud-value">{gs.current_state}</span></div>
    {#if zoneOf(gs.current_state)}<span class="badge hide-sm">{zoneOf(gs.current_state)}</span>{/if}
  </div>
  <div class="hud-item hud-clock">
    <Icon name={night ? "moon" : "sun"} />
    <div><span class="hud-label">Case clock</span><span class="hud-value">{parts.day} {parts.time}</span></div>
  </div>
  <div class="hud-deadline">
    <div class="row">
      <span class="hud-label">Deadline Monday 07:00</span>
      <span class:urgent-text={left.urgent}>{left.label}</span>
    </div>
    <div class="meter" class:urgent={left.urgent} role="progressbar" aria-label="Case time used" aria-valuemin="0" aria-valuemax="100" aria-valuenow={left.percentUsed}>
      <span style:width="{left.percentUsed}%"></span>
    </div>
  </div>
  <div class="hud-score"><span class="hud-label">Score</span><span class="hud-value">{gs.score.toLocaleString()}</span></div>
</section>
