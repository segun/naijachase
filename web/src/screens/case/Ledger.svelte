<script lang="ts">
  import type { AppController } from "../../state/app.svelte";
  import { ledgerView, money } from "../../domain/model.ts";

  let { app }: { app: AppController } = $props();
  const rows = $derived(ledgerView(app.ledger));
  const balance = $derived(app.game?.state.balance ?? 0);

  // The ledger is read-only server history; reload it whenever the balance moves.
  $effect(() => { void balance; void app.refreshLedger(); });
</script>

<section class="card ledger" aria-labelledby="ledger-title">
  <h2 id="ledger-title">Spending</h2>
  <p class="muted">Case funds are virtual and belong to this case only.</p>
  {#if rows.length === 0}
    <p class="muted">No spending yet.</p>
  {:else}
    <ol class="ledger-list">
      {#each rows as r (r.sequence)}
        <li class:allocation={r.allocation}>
          <div><strong>{r.title}</strong><small class="muted">{r.detail}</small></div>
          <div class="ledger-figures"><b>{r.allocation ? "" : r.cost === 0 ? "Free" : "\u2212" + money(r.cost)}</b><small class="muted">{money(r.balanceAfter)}</small></div>
        </li>
      {/each}
    </ol>
  {/if}
</section>
