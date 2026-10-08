<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { groupQuotes, questionedHere, usernameProblem } from "../model.ts";
  import Icon from "./Icon.svelte";
  import MoveDialog from "./MoveDialog.svelte";

  let { app }: { app: AppController } = $props();
  let open = $state(false);
  let venue = $state(""), helper = $state("");
  const gs = $derived(app.game!.state);
  // Only witnesses not yet questioned here can be delegated, and only on ordinary cases.
  const venues = $derived(groupQuotes(app.quotes, "local").filter(g => !questionedHere(gs).includes(g.id)));
  const problem = $derived(helper ? usernameProblem(helper) : null);

  $effect(() => { if (open && !venue && venues[0]) venue = venues[0].id; });
  $effect(() => { if (app.game && !app.coop.loaded) void app.loadCoop(); });
  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (!usernameProblem(helper) && venue && await app.askForHelp(venue, helper)) { open = false; helper = ""; }
  }
</script>

<button class="btn" type="button" onclick={() => (open = true)}><Icon name="helper" />Ask a friend for help</button>

{#if open}
  <MoveDialog title="Ask a friend for help" subtitle="They question one witness for you and reply with a short recommendation. You keep every decision." onclose={() => (open = false)}>
    <form class="form" onsubmit={send}>
      <label class="field"><span>Which witness?</span>
        <select class="select" bind:value={venue}>{#each venues as g}<option value={g.id}>{g.label}</option>{:else}<option value="" disabled>No witness left to delegate</option>{/each}</select>
      </label>
      <label class="field"><span>Their exact username</span>
        <input class="input" bind:value={helper} autocomplete="off" spellcheck="false" required />
      </label>
      {#if problem}<small class="hint warn">{problem}</small>{/if}
      <p class="muted hint">There is no player search. They'll have 12 hours to reply, and nothing is reserved for them.</p>
      <div class="row-actions">
        <button class="btn btn-primary" disabled={app.busy || !venue || !!problem || !helper}>{#if app.busy}<span class="spinner"></span> {/if}Send request</button>
        <button class="btn btn-ghost" type="button" onclick={() => (open = false)}>Cancel</button>
      </div>
    </form>
  </MoveDialog>
{/if}
