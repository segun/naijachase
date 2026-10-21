<script lang="ts">
  import { onMount } from "svelte";
  import {
    INSTALL_READY_EVENT,
    appleMobileBrowser,
    mobileBrowser,
    nativeInstallAvailable,
    promptForInstall,
    runningInstalled,
    safariBrowser
  } from "./install-prompt.ts";

  let dialog = $state<HTMLDialogElement>();
  let { inline = false }: { inline?: boolean } = $props();
  let mobile = $state(false);
  let installed = $state(false);
  let nativeInstall = $state(false);
  let fullscreen = $state(false);
  let installedThisSession = false;
  let instructions = $state<"install" | "fullscreen">("install");
  let message = $state("");

  const refresh = () => {
    mobile = mobileBrowser();
    installed = installedThisSession || runningInstalled();
    nativeInstall = nativeInstallAvailable();
    fullscreen = document.fullscreenElement !== null;
  };

  onMount(() => {
    refresh();
    const viewport = window.matchMedia("(pointer: coarse), (max-width: 960px)");
    const displayFullscreen = window.matchMedia("(display-mode: fullscreen)");
    const displayStandalone = window.matchMedia("(display-mode: standalone)");
    viewport.addEventListener("change", refresh);
    displayFullscreen.addEventListener("change", refresh);
    displayStandalone.addEventListener("change", refresh);
    window.addEventListener(INSTALL_READY_EVENT, refresh);
    const appInstalled = () => { installedThisSession = true; refresh(); };
    window.addEventListener("appinstalled", appInstalled);
    document.addEventListener("fullscreenchange", refresh);
    return () => {
      viewport.removeEventListener("change", refresh);
      displayFullscreen.removeEventListener("change", refresh);
      displayStandalone.removeEventListener("change", refresh);
      window.removeEventListener(INSTALL_READY_EVENT, refresh);
      window.removeEventListener("appinstalled", appInstalled);
      document.removeEventListener("fullscreenchange", refresh);
    };
  });

  function showInstructions(kind: "install" | "fullscreen", detail = "") {
    instructions = kind;
    message = detail;
    dialog?.showModal();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        return;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showInstructions("fullscreen", detail);
      return;
    }
    showInstructions("fullscreen");
  }

  async function install() {
    if (nativeInstall) {
      try {
        const outcome = await promptForInstall();
        if (outcome === "accepted") installedThisSession = true;
        refresh();
        if (outcome !== "unavailable") return;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        showInstructions("install", detail);
        return;
      }
    }
    showInstructions("install");
  }
</script>

{#if mobile && !installed}
  <nav class="mobile-app-actions" class:inline aria-label="Screen and app options">
    <button type="button" onclick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Go full screen"}>
      <span aria-hidden="true">{fullscreen ? "↙" : "⛶"}</span><span>{fullscreen ? "Exit" : "Full screen"}</span>
    </button>
    <button type="button" onclick={install} aria-label="Install Naija Chase on this device">
      <span aria-hidden="true">↓</span><span>Install app</span>
    </button>
  </nav>
{/if}

<dialog class="mobile-app-dialog card" bind:this={dialog} aria-labelledby="mobile-app-title" onclick={event => { if (event.target === dialog) dialog.close(); }}>
  <div class="mobile-app-dialog-body">
    {#if instructions === "fullscreen"}
      <p class="eyebrow">More playing space</p>
      <h2 id="mobile-app-title">Use Naija Chase without the address bar</h2>
      {#if appleMobileBrowser()}
        <p>iPhone and iPad browsers do not allow this page to switch itself into full screen. Install Naija Chase on your Home Screen, then open it from its icon.</p>
      {:else}
        <p>This browser did not allow full screen. You can install Naija Chase and open it from its Home Screen icon instead.</p>
      {/if}
    {:else}
      <p class="eyebrow">Install Naija Chase</p>
      <h2 id="mobile-app-title">Add the game to your Home Screen</h2>
      {#if appleMobileBrowser() && safariBrowser()}
        <ol>
          <li>Tap Safari's <strong>Share</strong> button.</li>
          <li>Choose <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>, then open Naija Chase from its new icon.</li>
        </ol>
      {:else if appleMobileBrowser()}
        <p>Open <strong>naijachase.app</strong> in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p>
      {:else}
        <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. Then launch Naija Chase from its icon.</p>
      {/if}
    {/if}
    {#if message}<p class="mobile-app-error muted">Browser detail: {message}</p>{/if}
    <div class="actions"><button class="btn btn-primary" type="button" onclick={() => dialog?.close()}>Got it</button></div>
  </div>
</dialog>

<style>
  .mobile-app-actions.inline { position: static; transform: none; max-width: none; border-radius: 10px; box-shadow: none; flex-wrap: wrap; }
  .mobile-app-actions.inline button { min-height: 44px; font-size: .9rem; }
  .mobile-app-actions {
    position: fixed;
    z-index: 49;
    top: max(.55rem, env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: .35rem;
    max-width: calc(100vw - 7rem - env(safe-area-inset-left) - env(safe-area-inset-right));
    padding: .25rem;
    border: 1px solid var(--line-soft);
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
    box-shadow: 0 8px 24px rgb(0 0 0 / .25);
    backdrop-filter: blur(12px);
  }
  .mobile-app-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: .35rem;
    min-height: 38px;
    padding: .35rem .65rem;
    border: 0;
    border-radius: 999px;
    color: var(--ink);
    background: transparent;
    font-size: .76rem;
    font-weight: 750;
    white-space: nowrap;
  }
  .mobile-app-actions button:hover,
  .mobile-app-actions button:focus-visible { color: var(--gold); background: var(--surface-2); }
  .mobile-app-actions button > span:first-child { font-size: 1rem; line-height: 1; }
  .mobile-app-dialog { width: min(29rem, calc(100vw - 2rem)); padding: 0; color: var(--ink); }
  .mobile-app-dialog::backdrop { background: rgb(0 8 6 / .78); backdrop-filter: blur(5px); }
  .mobile-app-dialog-body { display: grid; gap: 1rem; padding: 1.4rem; line-height: 1.55; }
  .mobile-app-dialog ol { margin: 0; padding-left: 1.4rem; display: grid; gap: .55rem; }
  .mobile-app-dialog .actions { display: flex; justify-content: flex-end; }
  .mobile-app-error { overflow-wrap: anywhere; font-size: .78rem; }

  @media (max-width: 430px) {
    .mobile-app-actions button { padding-inline: .5rem; }
    .mobile-app-actions button span:last-child { font-size: .7rem; }
  }
  @media (max-height: 470px) and (orientation: landscape) {
    .mobile-app-actions { top: max(.3rem, env(safe-area-inset-top)); }
    .mobile-app-actions button { min-height: 34px; padding-block: .2rem; }
  }
  @media (display-mode: fullscreen), (display-mode: standalone) {
    .mobile-app-actions { display: none; }
  }
</style>
