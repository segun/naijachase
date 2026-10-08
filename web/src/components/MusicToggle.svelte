<script lang="ts">
  import type { MenuMusic } from "../lib/music.svelte";
  import Icon from "./Icon.svelte";

  let { music }: { music: MenuMusic } = $props();
  const uid = $props.id();
  const menuId = `music-tunes-${uid}`;
  let open = $state(false);
  let root = $state<HTMLElement>();

  function away(e: Event) {
    if (open && root && e.target instanceof Node && !root.contains(e.target)) open = false;
  }

  function keys(e: KeyboardEvent) {
    if (open && e.key === "Escape") { e.stopPropagation(); open = false; (root?.querySelector(".music-pick") as HTMLElement | null)?.focus(); }
  }

  function choose(id: string) {
    music.choose(id);
    open = false;
  }
</script>

<svelte:window onpointerdown={away} onkeydown={keys} />

<div class="music-control" bind:this={root}>
  <button class="music-toggle" type="button" aria-pressed={music.enabled} aria-label="Music" onclick={() => music.toggle()}>
    <Icon name={music.enabled ? "music" : "mute"} />
    <span>Music {music.enabled ? "on" : "off"}</span>
  </button>
  <button class="music-toggle music-pick" type="button" aria-expanded={open} aria-controls={menuId} aria-label="Change tune" onclick={() => (open = !open)}>
    <Icon name="sliders" />
    <span>{music.tracks.find(t => t.id === music.trackId)?.name}</span>
  </button>
  {#if open}
    <ul class="music-menu" id={menuId} aria-label="Tunes">
      {#each music.tracks as track (track.id)}
        <li>
          <button type="button" aria-pressed={music.trackId === track.id} onclick={() => choose(track.id)}>
            <strong>{track.name}</strong><small>{track.mood}</small>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
