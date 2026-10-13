<script lang="ts">
  // Optional, risky: after questioning a witness the player may bribe or intimidate them. The server decides everything;
  // this screen only shows the published terms and asks for confirmation. It never reveals whether a witness holds more.
  import type { AppController } from "../../state/app.svelte";
  import type { QuoteGroup } from "../../domain/model.ts";
  import { PRESSURE_RULES, canAfford, pressureWarnings, type PressureMethod } from "../../domain/pressure.ts";
  import Icon from "../../ui/Icon.svelte";
  import MoveDialog from "./MoveDialog.svelte";

  let { app, venues, questioned }: { app: AppController; venues: QuoteGroup[]; questioned: readonly string[] } = $props();
  let pending = $state<{ venue: QuoteGroup; method: PressureMethod } | null>(null);
  const witnesses = $derived(venues.filter(v => questioned.includes(v.id)));
  const balance = $derived(app.tokenBalance);
  const enabled = $derived(app.game?.state.outcome === null && !app.busy);

  $effect(() => { if (app.game && app.tokenBalance === null) void app.loadTokens(); });
  $effect(() => { void app.game?.state_version; void app.loadPressure(); });

  async function confirm() {
    const choice = pending;
    if (!choice) return;
    pending = null;
    await app.pressureWitness(choice.venue.id, choice.venue.label, choice.method);
  }
</script>

{#if app.pressureNotice}
  {@const notice = app.pressureNotice}
  <MoveDialog title={notice.clue ? `${notice.venue} tells you more` : notice.venue} onclose={() => (app.pressureNotice = null)}>
    <p>{notice.clue ?? "The witness has nothing else to tell you."}</p>
    {#if notice.clue}<p class="muted">Added to your notebook.</p>{/if}
    <div class="row-actions"><button class="btn btn-primary" type="button" onclick={() => (app.pressureNotice = null)}>Continue the investigation</button></div>
  </MoveDialog>
{/if}

{#if witnesses.length}
  <section class="t-log t-pressure" aria-labelledby="pressure-title">
    <h2 id="pressure-title">Press a witness <span class="t-tokens" aria-label="Bribe tokens">Tokens: <strong>{balance ?? "…"}</strong></span></h2>
    <ul class="pressure-list">
      {#each witnesses as venue (venue.id)}
        {@const used = app.wasPressured(venue.id)}
        <li>
          <span class="t-who">{venue.label}</span>
          <div class="pressure-actions" role="group" aria-label="Actions for {venue.label}">
            {#if used}
              <span class="badge"><Icon name="check" />Already pressed</span>
            {:else}
              {#each ["bribe", "intimidate"] as const as method}
                <button class="t-opt t-small pressure-action" type="button" disabled={!enabled || (method === "bribe" && (balance === null || !canAfford(method, balance)))} onclick={() => (pending = { venue, method })}>
                  <span>{method === "intimidate" ? "Press" : PRESSURE_RULES[method].label}</span>{#if method === "bribe"}<small>1 token</small>{/if}
                </button>
              {/each}
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    {#if balance === 0}<p class="t-line t-hint">You have no bribe tokens. Earn them by solving cases cleanly; they cannot be bought.</p>{/if}
  </section>
{/if}

{#if pending}
  <MoveDialog title={pending.method === "intimidate" ? "Press witness for more information" : "Bribe witness"} onclose={() => (pending = null)}>
    <ul class="pressure-terms">
      {#each pressureWarnings(pending.method, balance ?? 0) as line}<li>{line}</li>{/each}
    </ul>
    <div class="row-actions">
      <button class="btn btn-ghost" type="button" onclick={() => (pending = null)}>Cancel</button>
      <button class="btn btn-danger" type="button" disabled={app.busy || (pending.method === "bribe" && (balance === null || !canAfford(pending.method, balance)))} onclick={confirm}>
        <Icon name="alert" />{pending.method === "intimidate" ? "Press" : "Bribe"}
      </button>
    </div>
  </MoveDialog>
{/if}
