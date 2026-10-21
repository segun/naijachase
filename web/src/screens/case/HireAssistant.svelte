<script lang="ts">
  import type { AppController } from "../../state/app.svelte";
  import { money } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";

  let { app, disabled = false }: { app: AppController; disabled?: boolean } = $props();
  const gs = $derived(app.game!.state);
  let dialog = $state<HTMLDialogElement>();

  async function hire() {
    if (!gs.assistant_available || gs.assistant_hired || app.busy || disabled) return;
    if (await app.command({ type: "hire_assistant" }, "Assistant hired.", "Hiring assistant")) dialog?.close();
  }
</script>

{#if gs.assistant_hired}
  <p class="assistant-active"><Icon name="check" /> Assistant hired · route advice is available in Travel.</p>
{:else if gs.assistant_available}
  <button class="assistant-hire" type="button" aria-haspopup="dialog" disabled={app.busy || disabled} onclick={() => dialog?.showModal()}>
    <Icon name="helper" />
    <span class="assistant-hire-copy">
      <strong>Hire an assistant</strong>
      <span>Auto-file suspect details and narrow down travel choices.</span>
      <small>{money(gs.assistant_cost)} · from this case’s budget</small>
    </span>
    <Icon name="arrow" />
  </button>

  <dialog class="move-dialog card assistant-dialog" bind:this={dialog} aria-labelledby="assistant-title" oncancel={event => { if (app.busy) event.preventDefault(); }} onclick={event => { if (event.target === dialog && !app.busy) dialog.close(); }}>
    <div class="move-dialog-body assistant-body">
      <header class="assistant-head">
        <span class="assistant-badge" aria-hidden="true"><Icon name="info" /></span>
        <h2 id="assistant-title">Hire an assistant</h2>
      </header>
      <p class="assistant-lead">An assistant will:</p>
      <ul class="assistant-perks">
        <li>Automatically file suspect details in your dossier.</li>
        <li>Suggest three possible onward routes when asked.</li>
        <li>Make journeys to local witnesses quicker.</li>
      </ul>
      <p class="assistant-cost"><span>Cost</span><strong>{money(gs.assistant_cost)}</strong><small>from this case's budget</small></p>
      {#if gs.balance < gs.assistant_cost}<p class="assistant-warn" role="alert">There is not enough money left in this case budget.</p>{/if}
      <div class="row-actions assistant-actions">
        <button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => dialog?.close()}>Not now</button>
        <button class="btn btn-primary" type="button" disabled={app.busy || gs.balance < gs.assistant_cost} onclick={hire}>
          {app.busy ? "Hiring…" : "Hire assistant"}
        </button>
      </div>
    </div>
  </dialog>
{/if}

<style>
  .assistant-hire { display: flex; align-items: center; gap: .75rem; width: 100%; min-height: 48px; padding: .85rem 1rem; border: 2px solid #ffe39a; border-radius: 12px; background: #ffe39a; color: #17271c; font: 1rem/1.4 var(--body); letter-spacing: normal; text-shadow: none; text-transform: none; text-align: left; cursor: pointer; }
  .assistant-hire:hover:not(:disabled) { background: #fff1c5; }
  .assistant-hire:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
  .assistant-hire:disabled { opacity: .6; cursor: default; }
  .assistant-hire :global(svg) { width: 1.4rem; height: 1.4rem; flex-shrink: 0; }
  .assistant-hire-copy { display: grid; gap: .2rem; flex: 1; min-width: 0; }
  .assistant-hire-copy strong { font-size: 1.1rem; }
  .assistant-hire-copy > span, .assistant-hire-copy small { font-size: .85rem; }
  .assistant-active { display: flex; align-items: center; gap: .5rem; margin: 0; color: var(--p-dim, var(--muted)); font: .9rem/1.5 var(--body); text-shadow: none; letter-spacing: normal; }
  .assistant-dialog { font: 400 1rem/1.5 system-ui, sans-serif; letter-spacing: normal; text-transform: none; text-shadow: none; text-align: left; vertical-align: baseline; width: min(26rem, calc(100vw - 2rem)); border-radius: 12px; box-shadow: 0 20px 60px rgb(0 0 0 / .5); }
  .assistant-body { gap: 1rem; padding: 1.5rem; }
  .assistant-head { display: flex; align-items: center; gap: .75rem; }
  .assistant-head h2 { margin: 0; font-size: 1.35rem; line-height: 1.2; letter-spacing: normal; text-transform: none; }
  .assistant-badge { display: grid; place-items: center; flex: none; width: 2.4rem; height: 2.4rem; border-radius: 50%; background: color-mix(in srgb, var(--amber, #ffd36b) 18%, transparent); color: var(--amber, #ffd36b); }
  .assistant-badge :global(svg) { width: 1.3rem; height: 1.3rem; }
  .assistant-lead { margin: 0; color: var(--muted); }
  .assistant-perks { list-style: none; display: grid; gap: .5rem; margin: 0; padding: 0; }
  .assistant-perks li { position: relative; padding: .6rem .8rem .6rem 2.2rem; border: 1px solid var(--line-soft, var(--line)); border-radius: 8px; background: rgb(255 255 255 / .04); }
  .assistant-perks li::before { content: "✓"; position: absolute; left: .8rem; color: var(--amber, #ffd36b); font-weight: 700; }
  .assistant-cost { display: flex; align-items: baseline; flex-wrap: wrap; gap: .5rem; margin: 0; padding: .7rem .9rem; border-radius: 8px; background: rgb(255 255 255 / .06); }
  .assistant-cost span { color: var(--muted); }
  .assistant-cost strong { font-size: 1.3rem; color: var(--amber, #ffd36b); }
  .assistant-cost small { color: var(--muted); }
  .assistant-warn { margin: 0; color: var(--warn, #ff8a7a); }
  .assistant-actions { justify-content: flex-end; }
</style>
