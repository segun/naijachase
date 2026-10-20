<script lang="ts">
  import { getUsageChoice, usage } from "../usage";
  let open = $state(getUsageChoice() === null);
  let choice = $state(getUsageChoice());
  function choose(value: "yes" | "no") {
    void usage.setChoice(value);
    choice = value;
    open = false;
  }
</script>

{#if open}
  <aside class="usage-choice" aria-label="Optional usage measurement">
    <strong>Help improve Naija Chase?</strong>
    <p>Allow us to measure visits and signup progress. If you enter an email during signup, we save the unfinished signup for up to 30 days. We don’t send marketing emails.</p>
    <a href="https://naijachase.com/privacy.html" target="_blank" rel="noopener">Privacy details</a>
    <div class="usage-actions">
      <button type="button" onclick={() => choose("no")}>No thanks</button>
      <button type="button" onclick={() => choose("yes")}>Allow measurement</button>
    </div>
  </aside>
{:else}
  <button class="usage-settings" type="button" onclick={() => open = true} aria-label={`Usage measurement ${choice === "yes" ? "on" : "off"}; change preference`}>Usage privacy</button>
{/if}

<style>
  .usage-choice { position: fixed; z-index: 10000; right: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); width: min(25rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow: auto; padding: 1.1rem; border: 1px solid #96afaa; border-radius: .8rem; background: #102923; color: #fff; box-shadow: 0 12px 40px #0006; font: 14px/1.5 system-ui, sans-serif; }
  .usage-choice strong { font-size: 1rem; } .usage-choice p { margin: .5rem 0; } .usage-choice a { color: #a4ecdb; text-decoration: underline; }
  .usage-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .8rem; }
  .usage-actions button, .usage-settings { border: 1px solid #96afaa; border-radius: .4rem; background: #173b32; color: #fff; cursor: pointer; padding: .65rem .8rem; font: inherit; }
  .usage-actions button:last-child { background: #b8f5dc; color: #102923; } button:focus-visible { outline: 3px solid #ffcc70; outline-offset: 3px; }
  .usage-settings { position: fixed; z-index: 100; right: max(.5rem, env(safe-area-inset-right)); bottom: max(.3rem, env(safe-area-inset-bottom)); padding: .25rem .45rem; font: 11px/1.4 system-ui, sans-serif; opacity: .85; }
</style>
