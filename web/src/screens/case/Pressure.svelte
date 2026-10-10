<script lang="ts">
  // Optional, risky: after questioning a witness the player may bribe or intimidate them. The server decides everything;
  // this screen only shows the published terms and asks for confirmation. It never reveals whether a witness holds more.
  import type { AppController } from "../../state/app.svelte";
  import type { QuoteGroup } from "../../domain/model.ts";
  import { PRESSURE_RULES, canAfford, pressureWarnings, tokenCost, type PressureMethod } from "../../domain/pressure.ts";
  import Icon from "../../ui/Icon.svelte";
  import MoveDialog from "./MoveDialog.svelte";

  let { app, venues, questioned }: { app: AppController; venues: QuoteGroup[]; questioned: readonly string[] } = $props();
  let pending = $state<{ venue: QuoteGroup; method: PressureMethod } | null>(null);
  const prompt = $derived(app.pressurePrompt && !app.wasPressured(app.pressurePrompt.venueId) && app.game?.state.outcome === null ? app.pressurePrompt : null);
  const ask = (id: string, label: string, method: PressureMethod) => { app.pressurePrompt = null; pending = { venue: { id, label, options: [] }, method }; };

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

{#if prompt}
  <MoveDialog title="{prompt.venueLabel}: anything more?" subtitle="You have heard their account. You may continue, or press them for more. Pressing is optional and risky; the ordinary clues are enough." onclose={() => (app.pressurePrompt = null)}>
    <div class="row-actions">
      <button class="btn btn-primary" type="button" onclick={() => (app.pressurePrompt = null)}>Continue</button>
      <button class="btn" type="button" disabled={balance === null || !canAfford("bribe", balance)} onclick={() => ask(prompt.venueId, prompt.venueLabel, "bribe")}>Bribe witness — 1 token</button>
      <button class="btn" type="button" onclick={() => ask(prompt.venueId, prompt.venueLabel, "intimidate")}>Intimidate witness</button>
    </div>
    {#if balance === 0}<p class="muted">You have no bribe tokens, so bribery is unavailable.</p>{/if}
  </MoveDialog>
{/if}

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
    <p class="t-line t-hint">Optional. A witness may hold a little extra, or nothing. Every witness accepts one attempt, it is risky, and the ordinary clues are always enough to solve the case.</p>
    <ul class="pressure-list">
      {#each witnesses as venue (venue.id)}
        {@const used = app.wasPressured(venue.id)}
        <li>
          <span class="t-who">{venue.label}</span>
          {#if used}
            <span class="badge"><Icon name="check" />Already pressed</span>
          {:else}
            {#each ["bribe", "intimidate"] as const as method}
              <button class="t-opt t-small" type="button" disabled={!enabled || (method === "bribe" && balance !== null && !canAfford(method, balance))} onclick={() => (pending = { venue, method })}>
                {PRESSURE_RULES[method].label}<small>{tokenCost(method)}</small>
              </button>
            {/each}
          {/if}
        </li>
      {/each}
    </ul>
    {#if balance === 0}<p class="t-line t-hint">You have no bribe tokens. Earn them by solving cases cleanly; they cannot be bought.</p>{/if}
  </section>
{/if}

{#if pending}
  {@const rule = PRESSURE_RULES[pending.method]}
  <MoveDialog title="{rule.label} {pending.venue.label}?" subtitle="Read the terms. This cannot be undone." onclose={() => (pending = null)}>
    <ul class="pressure-terms">
      {#each pressureWarnings(pending.method, balance ?? 0) as line}<li>{line}</li>{/each}
    </ul>
    <div class="row-actions">
      <button class="btn btn-ghost" type="button" onclick={() => (pending = null)}>Cancel</button>
      <button class="btn btn-danger" type="button" disabled={app.busy || balance === null || !canAfford(pending.method, balance)} onclick={confirm}>
        <Icon name="alert" />{rule.label} ({tokenCost(pending.method)})
      </button>
    </div>
  </MoveDialog>
{/if}
