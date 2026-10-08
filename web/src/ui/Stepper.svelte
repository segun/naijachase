<script lang="ts">
  import { TOTAL_STOPS } from "../domain/model.ts";
  let { stage }: { stage: number } = $props();
</script>

<ol class="stepper" aria-label="Trail progress: stop {Math.min(stage + 1, TOTAL_STOPS)} of {TOTAL_STOPS}">
  {#each Array.from({ length: TOTAL_STOPS }, (_, i) => i) as i}
    <li class:done={i < stage} class:current={i === stage} aria-current={i === stage ? "step" : undefined}><span class="sr-only">Stop {i + 1}{i < stage ? " complete" : i === stage ? " current" : ""}</span></li>
  {/each}
</ol>
