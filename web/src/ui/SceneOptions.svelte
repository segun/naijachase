<script lang="ts">
  import type { MenuMusic } from "../music/music.svelte";
  import MusicToggle from "../music/MusicToggle.svelte";
  import { detail } from "../scenes/shared/detail.svelte.ts";
  import { DETAIL_TEXT } from "../scenes/shared/detail-level.ts";
  import DetailControl from "./DetailControl.svelte";
  import Icon from "./Icon.svelte";

  let { music }: { music: MenuMusic } = $props();
  const uid = $props.id();
  const panelId = `scene-options-${uid}`;
  const detailId = `scene-detail-${uid}`;
  let open = $state(false);
  let detailOpen = $state(false);
  let root = $state<HTMLElement>();
  let toggle = $state<HTMLButtonElement>();

  function away(event: Event) {
    if (open && root && event.target instanceof Node && !root.contains(event.target)) {
      open = false;
      detailOpen = false;
    }
  }

  function key(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      open = false;
      detailOpen = false;
      toggle?.focus();
    }
  }
</script>

<svelte:window onpointerdown={away} onfocusin={away} onkeydowncapture={key} />

<div class="scene-options" bind:this={root}>
  <button class="scene-options-toggle" type="button" bind:this={toggle}
    aria-label="Game options" aria-expanded={open} aria-controls={panelId}
    onclick={() => { open = !open; detailOpen = false; }}>
    <Icon name="menu" />
  </button>
  {#if open}
    <nav class="scene-options-panel" id={panelId} aria-label="Game options">
      <button class="scene-detail-toggle" type="button" aria-expanded={detailOpen}
        aria-controls={detailId} onclick={() => (detailOpen = !detailOpen)}>
        <span aria-hidden="true">◐</span><span>Detail: {DETAIL_TEXT[detail.resolved.level].label}</span>
      </button>
      {#if detailOpen}<div class="scene-options-detail" id={detailId}><DetailControl compact /></div>{/if}
      <MusicToggle {music} />
    </nav>
  {/if}
</div>

<style>
  .scene-options {
    position: fixed;
    top: max(.55rem, env(safe-area-inset-top));
    right: max(.55rem, env(safe-area-inset-right));
    z-index: 50;
    display: grid;
    justify-items: end;
    gap: .5rem;
    pointer-events: none;
  }
  .scene-options-toggle {
    pointer-events: auto;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: .65rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
    color: var(--ink);
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
  }
  .scene-options-panel {
    pointer-events: auto;
    display: grid;
    gap: .35rem;
    width: min(21rem, calc(100vw - 1.1rem - env(safe-area-inset-left) - env(safe-area-inset-right)));
    max-height: calc(100dvh - 4.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    overflow-y: auto;
    padding: .5rem;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: 0 10px 30px #0008;
    overscroll-behavior: contain;
  }
  .scene-detail-toggle,
  .scene-options :global(.music-toggle) {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: .65rem;
    width: 100%;
    min-height: 44px;
    padding: .65rem .8rem;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--ink);
    box-shadow: none;
    font-size: .9rem;
    font-weight: 700;
    text-align: left;
  }
  .scene-detail-toggle > span:first-child { width: 1.2rem; text-align: center; }
  .scene-options-toggle:hover,
  .scene-detail-toggle:hover,
  .scene-options :global(.music-toggle:hover) { color: var(--gold); border-color: var(--line); }
  .scene-options :global(.music-control) { display: grid; gap: .35rem; min-width: 0; }
  .scene-options :global(.music-toggle span) { display: inline; white-space: normal; }
  .scene-options :global(.music-pick span)::before { content: "Tune: "; }
  .scene-options :global(.music-toggle[aria-pressed="true"]) { color: var(--gold); }
  .scene-options :global(.music-menu) {
    position: static;
    width: auto;
    min-width: 0;
    max-height: min(18rem, 45dvh);
    margin: 0;
    box-shadow: none;
  }
  .scene-options-detail { padding: .25rem .35rem .65rem; }
  .scene-options-detail :global(.segmented) { flex-wrap: wrap; }
</style>
