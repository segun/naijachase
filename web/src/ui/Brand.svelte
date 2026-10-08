<script lang="ts">
  import Icon from "./Icon.svelte";
  let { onclick }: { onclick?: () => void } = $props();
</script>

{#snippet inner()}
  <span class="brand-mark"><Icon name="pin" /></span>
  <span class="brand-name">NAIJA CHASE<small>Detective agency</small></span>
{/snippet}

{#if onclick}
  <button type="button" class="brand" aria-label="Naija Chase home" {onclick}>{@render inner()}</button>
{:else}
  <div class="brand">{@render inner()}</div>
{/if}
