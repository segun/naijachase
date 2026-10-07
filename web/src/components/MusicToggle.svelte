<script lang="ts">
  import type { MenuMusic } from "../lib/music.svelte";
  import Icon from "./Icon.svelte";

  let { music }: { music: MenuMusic } = $props();
</script>

<button class="music-toggle" type="button" aria-pressed={music.enabled} aria-label="Menu music" onclick={() => music.toggle()}>
  <Icon name={music.enabled ? "music" : "mute"} />
  <span>Music {music.enabled ? "on" : "off"}</span>
</button>
