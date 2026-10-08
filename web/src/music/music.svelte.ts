import { DEFAULT_TRACK_ID, TRACK_INFO, isTrackId } from "./music-catalogue.ts";
import type { ScorePlayer } from "./music-engine.ts";
import type { findTrack } from "./music-score.ts";

type Loaded = { player: ScorePlayer; find: typeof findTrack };

/**
 * The game's music: it starts on the home screen and keeps playing through sign-in and the game itself.
 * Browsers block audio until the player interacts, so playback is armed and starts on the first tap or key press.
 */
export class MenuMusic {
  private player: ScorePlayer | null = null;
  private loading: Promise<Loaded> | null = null;
  private armed = false;
  private unlocked = false;

  /** The player's on/off preference, remembered on this device. */
  enabled = $state(localStorage.getItem("nc-music") !== "off");
  /** The chosen tune, remembered on this device. */
  trackId = $state(this.storedTrack());
  readonly tracks = TRACK_INFO;
  /** False while the app is still starting up. */
  active = $state(false);
  playing = $state(false);

  setActive(value: boolean) {
    this.active = value;
    void this.sync();
  }

  /** Picks a tune. Choosing one also switches the music on, since the player clearly wants to hear it. */
  choose(id: string) {
    if (!isTrackId(id)) return;
    this.trackId = id;
    this.enabled = true;
    this.unlocked = true; // the click that chose it is itself a user gesture
    localStorage.setItem("nc-music-track", id);
    localStorage.setItem("nc-music", "on");
    void this.sync();
  }

  private storedTrack(): string {
    const id = localStorage.getItem("nc-music-track");
    return isTrackId(id) ? id : DEFAULT_TRACK_ID;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.unlocked = true; // a click on the button is itself a user gesture
    localStorage.setItem("nc-music", this.enabled ? "on" : "off");
    void this.sync();
  }

  /** Quietens the music while a scene plays its own sound. Does nothing if the music is not playing. */
  duck(on: boolean) { this.player?.duck(on); }

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
      this.loading ??= Promise.all([import("./music-engine.ts"), import("./music-score.ts")])
        .then(([{ ScorePlayer }, { findTrack }]) => ({ player: (this.player = new ScorePlayer()), find: findTrack }));
      const { player, find } = await this.loading;
      await player.start(find(this.trackId));
      this.playing = player.running;
    } catch { this.playing = false; }
  }
}
