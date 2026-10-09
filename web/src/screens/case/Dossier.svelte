<script lang="ts">
  import { untrack } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { FIELD_META, dossierCount } from "../../domain/model.ts";
  import DossierOptionsStatus from "../../ui/DossierOptionsStatus.svelte";
  import Icon from "../../ui/Icon.svelte";

  let { app }: { app: AppController } = $props();
  const recorded = $derived(app.game!.state.dossier);
  let values = $state<Record<string, string>>(untrack(() => ({ ...app.game!.state.dossier })));
  const count = $derived(dossierCount(recorded));
  const changed = $derived(app.dossierOptions?.fields.filter(({ field, options }) => options.includes(values[field] ?? "") && values[field] !== recorded[field]) ?? []);
  const circumference = 2 * Math.PI * 34;

  async function save(event: SubmitEvent) {
    event.preventDefault();
    await app.saveDossier(values);
  }
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Suspect dossier</p>
    <h1>Build the profile</h1>
    <p>Select only what you infer from witness wording. All eight details are needed before a warrant can be requested.</p>
  </header>

  <div class="dossier-top card rise">
    <svg class="ring" viewBox="0 0 80 80" role="img" aria-label="{count} of 8 details recorded">
      <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line-soft)" stroke-width="7" />
      <circle cx="40" cy="40" r="34" fill="none" stroke="var(--green)" stroke-width="7" stroke-linecap="round" stroke-dasharray={circumference} stroke-dashoffset={circumference * (1 - count / 8)} transform="rotate(-90 40 40)" />
      <text x="40" y="46" text-anchor="middle" font-size="20" font-weight="800" fill="var(--ink)">{count}/8</text>
    </svg>
    <div>
      <h2>{count === 8 ? "Profile complete" : `${8 - count} detail${8 - count === 1 ? "" : "s"} still unknown`}</h2>
      <p class="muted">{count === 8 ? "Review your entries, then request a warrant." : "Check your notebook for descriptions you may have missed."}</p>
    </div>
    {#if count === 8}<button class="btn btn-primary" type="button" onclick={() => app.go("warrant")}>Request warrant <Icon name="arrow" /></button>{/if}
  </div>

  <DossierOptionsStatus {app} />
  <form class="dossier-grid" onsubmit={save}>
    {#each app.dossierOptions?.fields ?? [] as entry, i}
      {@const field = entry.field}
      {@const meta = FIELD_META[field]}
      <label class="trait card rise" class:filled={!!recorded[field]} style:animation-delay="{i * 0.04}s">
        <span class="trait-head"><span>{entry.label}</span>{#if recorded[field]}<span class="badge badge-green"><Icon name="check" />Recorded</span>{/if}</span>
        <select class="select" name={field} bind:value={values[field]} disabled={app.busy}>
          <option value="">Not yet known</option>
          {#each entry.options as option}<option value={option}>{option}</option>{/each}
        </select>
        {#if recorded[field] && !entry.options.includes(recorded[field])}<small class="hint warn">Previously recorded: {recorded[field]}. Choose a listed value to replace it.</small>{/if}
        <small class="muted">{meta.hint}</small>
      </label>
    {/each}
    <div class="dossier-actions">
      <button class="btn btn-primary btn-lg" disabled={app.busy || !app.dossierOptions || changed.length === 0}>
        {#if app.busy}<span class="spinner"></span> {app.busyLabel}…{:else}Record {changed.length || ""} changed detail{changed.length === 1 ? "" : "s"}{/if}
      </button>
    </div>
  </form>
</div>
