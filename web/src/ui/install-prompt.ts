/** The Chromium install event is intentionally not part of the standard DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listening = false;

export const INSTALL_READY_EVENT = "naijachase:install-ready";

/** Start listening before Svelte mounts so a quick browser event is never lost. */
export function captureInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_READY_EVENT));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event(INSTALL_READY_EVENT));
  });
}

export function nativeInstallAvailable() {
  return deferredPrompt !== null;
}

export async function promptForInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  deferredPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  window.dispatchEvent(new Event(INSTALL_READY_EVENT));
  return outcome;
}

export function runningInstalled() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone === true
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.matchMedia("(display-mode: standalone)").matches;
}

export function mobileBrowser() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse), (max-width: 960px)").matches;
}

export function appleMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function safariBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android/i.test(navigator.userAgent);
}
