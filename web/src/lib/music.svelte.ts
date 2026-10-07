import type { ScorePlayer } from "./music-engine.ts";

/**
 * Menu music for the screens before the game (home, register, login).
 * Browsers block audio until the player interacts, so playback is armed and starts on the first tap or key press.
 */
export class MenuMusic {
  private player: ScorePlayer | null = null;
  private loading: Promise<ScorePlayer> | null = null;
  private armed = false;
  private unlocked = false;

  /** The player's on/off preference, remembered on this device. */
  enabled = $state(localStorage.getItem("nc-music") !== "off");
  /** Whether the current screen is one where menu music belongs. */
  active = $state(false);
  playing = $state(false);

  setActive(value: boolean) {
    this.active = value;
    void this.sync();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.unlocked = true; // a click on the button is itself a user gesture
    localStorage.setItem("nc-music", this.enabled ? "on" : "off");
    void this.sync();
  }

  private arm() {
    if (this.armed) return;
    this.armed = true;
    const events = ["pointerdown", "pointerup", "keydown"] as const;
    const unlock = () => {
      events.forEach(e => window.removeEventListener(e, unlock));
      this.armed = false;
      this.unlocked = true;
      void this.sync();
    };
    events.forEach(e => window.addEventListener(e, unlock));
  }

  private async sync() {
    if (!(this.enabled && this.active)) {
      this.player?.stop();
      this.playing = false;
      return;
    }
    const allowed = this.unlocked || navigator.userActivation?.hasBeenActive === true;
    if (!allowed) { this.arm(); return; }
    try {
      // The synthesiser is loaded on demand so it never weighs on the initial bundle.
      // One shared load, so concurrent calls can never create two players.
      this.loading ??= import("./music-engine.ts").then(({ ScorePlayer }) => (this.player = new ScorePlayer()));
      const player = await this.loading;
      await player.start();
      this.playing = player.running;
    } catch { this.playing = false; }
  }
}
