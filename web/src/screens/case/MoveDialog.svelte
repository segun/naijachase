<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, subtitle, onclose, dismissible = true, children }: { title: string; subtitle?: string; onclose: () => void; /** False: Escape and clicks outside do nothing, so only the dialog's own buttons can close it. */ dismissible?: boolean; children: Snippet } = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;

  // A native modal dialog gives focus trapping, Escape to close and inert background for free.
  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (!el.open) el.showModal();
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (el.open) el.close(); opener?.focus?.(); };
  });
</script>

<dialog class="move-dialog card" bind:this={dialog} aria-labelledby={titleId} onclose={onclose} oncancel={(e) => { if (!dismissible) e.preventDefault(); }} onclick={(e) => { if (dismissible && e.target === dialog) onclose(); }}>
  <div class="move-dialog-body">
    <h2 id={titleId}>{title}</h2>
    {#if subtitle}<p class="muted">{subtitle}</p>{/if}
    {@render children()}
  </div>
</dialog>
