<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import Icon from "./Icon.svelte";
  let { app }: { app: AppController } = $props();
</script>

<div class="sr-only" aria-live="polite" aria-atomic="true">{app.announcement}</div>
<div class="toasts">
  {#each app.toasts as t (t.id)}
    <div class="toast {t.kind}" role={t.kind === "error" ? "alert" : undefined}>
      <Icon name={t.kind === "error" ? "alert" : t.kind === "success" ? "check" : "chat"} />
      <p>{t.text}</p>
      <button type="button" aria-label="Dismiss message" onclick={() => app.dismiss(t.id)}><Icon name="x" /></button>
    </div>
  {/each}
</div>
