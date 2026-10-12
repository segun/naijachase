<script lang="ts">
  // The five-member disciplinary panel after a detected offence. It replays the server's arrivals, votes and decision in the
  // order returned and can neither change nor re-roll any of them. Skipping, or reduced motion, shows the verdict at once.
  import { onMount, untrack } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { consequenceLines, offenceLabel, panelSteps, punishmentLabel, tally } from "../../domain/pressure.ts";
  import MoveDialog from "../case/MoveDialog.svelte";
  import Icon from "../../ui/Icon.svelte";

  /** `from` lets the 3D scene hand over part-way: the steps up to it are already shown. */
  let { app, from = 0, onProgress }: { app: AppController; from?: number; /** Told how many steps are shown, so the 3D scene can pick up from here if the picture detail is raised. */ onProgress?: (shown: number) => void } = $props();
  const visit = $derived(app.panel!);
  const steps = $derived(panelSteps(visit.panel, visit.result?.events));
  const quiet = untrack(() => matchMedia("(prefers-reduced-motion: reduce)").matches || app.settings.motion === "reduced");
  let shown = $state(quiet ? Infinity : untrack(() => from));

  $effect(() => { onProgress?.(shown); });
  const done = $derived(shown >= steps.length);
  const seated = (position: number) => steps.slice(0, shown).some(s => s.kind === "arrive" && s.position === position);
  const voteAt = (position: number) => steps.slice(0, shown).find(s => s.kind === "vote" && s.position === position)?.vote;
  const seats = $derived(steps.filter(s => s.kind === "arrive").map(s => s.position));
  const counted = $derived(tally(visit.panel.votes));
  let status = $state<HTMLElement>();

  onMount(() => {
    if (quiet) return;
    const timer = setInterval(() => { shown += 1; if (shown >= steps.length) clearInterval(timer); }, 800);
    return () => clearInterval(timer);
  });
  $effect(() => { if (done) queueMicrotask(() => status?.focus()); });
</script>

<MoveDialog title="Disciplinary panel" subtitle={visit.venue ? `${offenceLabel(visit.panel.offence)} reported after pressing ${visit.venue}.` : `${offenceLabel(visit.panel.offence)}: the panel has reached a decision you have not yet seen.`} dismissible={false} onclose={() => {}}>
  <ol class="panel-seats" aria-label="Panel members">
    {#each seats as position}
      {@const vote = voteAt(position)}
      <li class:seated={seated(position)} class:punish={vote === "punish"} class:warning={vote === "warning"}>
        <Icon name="user" />
        <span>Member {position}</span>
        <span class="vote">{vote === "punish" ? "Punish" : vote === "warning" ? "Warning" : seated(position) ? "Deciding…" : ""}</span>
      </li>
    {/each}
  </ol>

  <div class="panel-verdict" tabindex="-1" bind:this={status} role="status" aria-live="polite">
    {#if done}
      <strong>{visit.panel.decision === "punish" ? "Punished" : "Released with a warning"} · {counted.punish} to {counted.warning}</strong>
      <span>{punishmentLabel(visit.panel.punishment)}.</span>
      <ul>{#each consequenceLines(visit.panel) as line}<li>{line}</li>{/each}</ul>
      <small class="muted">The panel's decision is final. Punishments cannot be bought off.</small>
    {:else}
      <span>The panel is convening…</span>
    {/if}
  </div>

  <div class="row-actions">
    {#if !done}<button class="btn btn-ghost" type="button" onclick={() => (shown = Infinity)}>Skip to verdict</button>{/if}
    <button class="btn btn-primary" type="button" disabled={!done} onclick={() => app.dismissPanel()}>{visit.panel.punishment === "jailed" || app.game?.state.outcome ? "Acknowledge and leave" : "Acknowledge and return to the case"}</button>
  </div>
</MoveDialog>
