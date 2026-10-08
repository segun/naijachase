<script lang="ts">
  // The case archive: the avatar walks into a records room, takes a file off the shelf and the camera zooms onto the file,
  // where the list of closed cases (Archive) is shown on a manila sheet.
  import "../styles/terminal.css";
  import type { AppController } from "../lib/app.svelte";
  import Archive from "./Archive.svelte";
  import Icon from "./Icon.svelte";
  import Stage from "./Stage.svelte";

  let { app }: { app: AppController } = $props();
  let sheet = $state<HTMLElement>();

  function key(e: KeyboardEvent) {
    if (e.key !== "Escape" || e.metaKey || e.ctrlKey || e.altKey || !sheet || sheet.closest("[inert]")) return;
    e.preventDefault();
    app.go("cases");
  }
</script>

<svelte:window onkeydown={key} />

<Stage {app} seenKey="nc-archive" sheet="paper" loading="Opening the archive…" load={(canvas, options) => import("../lib/chase3d-archive.ts").then(m => m.createArchiveScene(canvas, options))}>
  {#snippet children(awake)}
    <section class="sheet" bind:this={sheet} class:on={awake} aria-label="Case archive">
      <header class="sheet-bar">
        <span class="sheet-tab"><Icon name="archive" /> Case archive</span>
        <button class="btn sheet-back" type="button" onclick={() => app.go("cases")}><Icon name="home" /> Back to the desk <kbd>Esc</kbd></button>
      </header>
      <div class="sheet-body"><Archive {app} /></div>
    </section>
  {/snippet}
</Stage>
