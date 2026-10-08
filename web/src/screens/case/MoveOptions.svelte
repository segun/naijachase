<script lang="ts">
  import { untrack } from "svelte";
  import { MODE_LABEL, MODE_NOTE, defaultOption, duration, money, project, type Mode, type QuoteGroup } from "../../domain/model.ts";
  import type { TransportQuote } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";

  let { group, elapsed, balance, busy, confirmLabel, working, onconfirm, oncancel }: {
    group: QuoteGroup; elapsed: number; balance: number; busy: boolean; confirmLabel: string; working?: string;
    onconfirm: (quote: TransportQuote) => void; oncancel?: () => void;
  } = $props();

  let chosen = $state<Mode | null>(untrack(() => defaultOption(group.options, elapsed, balance)?.mode ?? null));
  const quote = $derived(group.options.find(o => o.mode === chosen) ?? null);
  const plan = $derived(quote ? project(elapsed, balance, quote) : null);
  const id = `mv-${Math.random().toString(36).slice(2, 8)}`;
  const icon: Record<Mode, string> = { fly: "plane", drive: "car", hitch_ride: "thumb" };
</script>

<fieldset class="move-options" disabled={busy}>
  <legend class="sr-only">How will you get to {group.label}?</legend>
  {#each group.options as o (o.mode)}
    {@const p = project(elapsed, balance, o)}
    <label class="move-option" class:selected={chosen === o.mode} class:unavailable={!o.affordable}>
      <input type="radio" name={id} value={o.mode} bind:group={chosen} disabled={!o.affordable} />
      <span class="move-icon"><Icon name={icon[o.mode] ?? "pin"} /></span>
      <span class="move-body">
        <strong>{MODE_LABEL[o.mode]}</strong>
        <small class="muted">{o.affordable ? MODE_NOTE[o.mode] : "You can't afford this option."}</small>
      </span>
      <span class="move-figures">
        <b>{o.cost === 0 ? "Free" : money(o.cost)}</b>
        <small>{duration(p.totalMinutes)}</small>
      </span>
    </label>
  {/each}
</fieldset>

{#if quote && plan}
  <dl class="move-summary" aria-live="polite">
    <div><dt>Destination</dt><dd>{group.label}</dd></div>
    <div><dt>Fare</dt><dd>{quote.cost === 0 ? "Free" : money(quote.cost)}</dd></div>
    <div><dt>Journey</dt><dd>{duration(quote.travel_minutes)}</dd></div>
    {#if quote.wait_minutes > 0}<div><dt>Waiting for opening hours</dt><dd>{duration(quote.wait_minutes)}</dd></div>{/if}
    <div><dt>Estimated arrival</dt><dd>{plan.arrival}</dd></div>
    <div><dt>Balance after</dt><dd>{money(plan.balanceAfter)}</dd></div>
  </dl>
  {#if plan.missesDeadline}
    <p class="move-warning" role="alert"><Icon name="alert" />This would arrive after the Monday 07:00 deadline.</p>
  {/if}
{/if}

<div class="row-actions">
  <button class="btn btn-primary btn-lg" type="button" disabled={busy || !quote} onclick={() => quote && onconfirm(quote)}>
    {#if busy}<span class="spinner"></span> {working ?? "Working"}…{:else}{confirmLabel}{/if}
  </button>
  {#if oncancel}<button class="btn btn-ghost" type="button" disabled={busy} onclick={oncancel}>Cancel</button>{/if}
</div>
