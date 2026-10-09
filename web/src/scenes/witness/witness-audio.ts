// The sound of the witness scene, made with the Web Audio API so there is nothing to download: the venue's ambience (a market's crowd
// murmur, traders calling out, a generator, coins and bells), the vehicle's engine, footsteps and the witness's voice, which is a
// babble of one short voiced note per syllable timed to the subtitles, not recognisable words. Everything is quiet by design: the
// subtitles carry the meaning, the sound carries the place.
import type { SoundMix } from "./venue-recipes.ts";
import type { WordTiming } from "./witness-scene.ts";

export type WitnessAudio = {
  /** Called every frame with how fast the vehicle is going (0 to 1). */
  engine(speed: number): void;
  step(): void;
  door(): void;
  /** Schedules a voice for the words, starting `startsIn` seconds from now. */
  speak(timings: readonly WordTiming[], startsIn: number, pitch: number, seed: number): void;
  dispose(): void;
};

/** How loud the witness's voice is, against an ambience that peaks around 0.15. */
const VOICE_LEVEL = 0.22;

/** The two main resonances of five vowel sounds, so the babble does not drone on one note. */
const VOWELS: readonly (readonly [number, number])[] = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870]];

export function random(seed: number): () => number {
  // Seeds can be negative (a hash XOR) or fractional; the generator needs a whole number from 1 to 2147483646.
  let s = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function createWitnessAudio(mix: SoundMix, vehicle: "car" | "bus", seed: number): WitnessAudio | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioContext;
  try { ctx = new Ctor(); } catch { return null; }
  void ctx.resume().catch(() => {});
  const rnd = random(seed);
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
  master.connect(ctx.destination);

  const length = ctx.sampleRate * 2;
  const noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = rnd() * 2 - 1;
  const loop = (type: BiquadFilterType, freq: number, q: number, level: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(master);
    src.start(0, rnd());
    return gain;
  };

  // Ambience: a murmur that swells and falls, a brighter chatter above it and a low rumble beneath.
  const murmurLevel = 0.11 * mix.crowd, chatterLevel = 0.03 * mix.crowd;
  const murmur = loop("bandpass", 650, 0.5, murmurLevel);
  const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.19; lfoDepth.gain.value = 0.035 * mix.crowd;
  lfo.connect(lfoDepth).connect(murmur.gain); lfo.start();
  const chatter = loop("bandpass", 1900, 1.1, chatterLevel);
  loop("lowpass", 180, 0.7, 0.07 * mix.crowd);
  const hum = ctx.createOscillator(), humGain = ctx.createGain(), humFilter = ctx.createBiquadFilter();
  hum.type = "sawtooth"; hum.frequency.value = 49; humFilter.type = "lowpass"; humFilter.frequency.value = 170; humGain.gain.value = 0.03 * mix.hum;
  hum.connect(humFilter).connect(humGain).connect(master); hum.start();

  const engineOsc = ctx.createOscillator(), engineGain = ctx.createGain(), engineFilter = ctx.createBiquadFilter();
  engineOsc.type = "sawtooth"; engineFilter.type = "lowpass"; engineFilter.frequency.value = vehicle === "bus" ? 260 : 340;
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master); engineOsc.start();

  const blip = (at: number, freq: number, seconds: number, level: number, vowel: number, pan = 0) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.linearRampToValueAtTime(freq * (0.9 + rnd() * 0.2), at + seconds);
    const [f1, f2] = VOWELS[Math.abs(vowel) % VOWELS.length]!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(level, at + seconds * 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    for (const f of [f1, f2]) {
      const band = ctx.createBiquadFilter();
      band.type = "bandpass"; band.frequency.value = f; band.Q.value = 5;
      osc.connect(band).connect(env);
    }
    env.connect(panner).connect(master);
    osc.start(at); osc.stop(at + seconds + 0.05);
  };
  const ping = (at: number, freq: number, level: number) => {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = "triangle"; osc.frequency.value = freq;
    env.gain.setValueAtTime(level, at); env.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    osc.connect(env).connect(master);
    osc.start(at); osc.stop(at + 0.75);
  };
  const burst = (at: number, freq: number, seconds: number, level: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(level, at); env.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    src.connect(filter).connect(env).connect(master);
    src.start(at, rnd()); src.stop(at + seconds + 0.02);
  };

  // Every so often a trader calls out somewhere in the distance, or a coin or a bell rings.
  const ambience = setInterval(() => {
    const at = ctx.currentTime + 0.05;
    if (rnd() < 0.3 * mix.calls) {
      const pitch = 120 + rnd() * 200, pan = rnd() * 1.6 - 0.8, count = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < count; i++) blip(at + i * 0.21, pitch * (1 + (i % 2) * 0.12), 0.2, 0.025, Math.floor(rnd() * 5), pan);
    }
    if (rnd() < 0.18 * mix.clinks) ping(at, 1800 + rnd() * 1800, 0.012);
  }, 450);

  // Anything else the venue sounds like (see SoundExtra in recipe-kit.ts): bells and whistles, surf and wind, drums, birds.
  const extras = mix.extras ?? [];
  for (const e of extras) {
    if (e.kind !== "swell") continue;
    const gain = loop(e.filter ?? "bandpass", e.freq, e.q ?? 0.8, e.level);
    const swell = ctx.createOscillator(), depth = ctx.createGain();
    swell.frequency.value = e.rate; depth.gain.value = e.level * 0.7;
    swell.connect(depth).connect(gain.gain); swell.start();
  }
  const tone = (at: number, e: Extract<(typeof extras)[number], { kind: "tone" }>) => {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = e.shape ?? "sine";
    osc.frequency.setValueAtTime(e.freq, at);
    if (e.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, e.freq * e.slide), at + e.length);
    if (e.vibrato) { const v = ctx.createOscillator(), d = ctx.createGain(); v.frequency.value = 5.5; d.gain.value = e.freq * 0.015; v.connect(d).connect(osc.frequency); v.start(at); v.stop(at + e.length + 0.1); }
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(e.level, at + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, at + e.length);
    osc.connect(env).connect(master);
    osc.start(at); osc.stop(at + e.length + 0.05);
  };
  const chirp = (at: number, freq: number, level: number) => {
    const osc = ctx.createOscillator(), env = ctx.createGain(), pan = ctx.createStereoPanner();
    osc.frequency.setValueAtTime(freq, at); osc.frequency.exponentialRampToValueAtTime(freq * (0.8 + rnd() * 0.6), at + 0.08);
    env.gain.setValueAtTime(level, at); env.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    pan.pan.value = rnd() * 1.6 - 0.8;
    osc.connect(env).connect(pan).connect(master);
    osc.start(at); osc.stop(at + 0.12);
  };
  const thump = (at: number, freq: number, level: number) => {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.frequency.setValueAtTime(freq * 2.2, at); osc.frequency.exponentialRampToValueAtTime(freq, at + 0.12);
    env.gain.setValueAtTime(level, at); env.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(env).connect(master);
    osc.start(at); osc.stop(at + 0.32);
  };
  const extraTimers: ReturnType<typeof setInterval>[] = [];
  if (extras.some(e => e.kind === "tone" || e.kind === "chirps")) {
    extraTimers.push(setInterval(() => {
      const at = ctx.currentTime + 0.05;
      for (const e of extras) {
        if (e.kind === "tone" && rnd() < 0.45 / Math.max(0.5, e.every)) tone(at, e);
        if (e.kind === "chirps" && rnd() < e.rate * 0.45) chirp(at, e.freq * (0.85 + rnd() * 0.3), e.level);
      }
    }, 450));
  }
  for (const e of extras) if (e.kind === "pulse") extraTimers.push(setInterval(() => thump(ctx.currentTime + 0.02, e.freq, e.level), 60000 / Math.max(30, e.bpm)));

  /** The crowd drops back while the witness speaks so the voice is clear. */
  const duck = (on: boolean) => {
    murmur.gain.setTargetAtTime(murmurLevel * (on ? 0.35 : 1), ctx.currentTime, 0.3);
    chatter.gain.setTargetAtTime(chatterLevel * (on ? 0.35 : 1), ctx.currentTime, 0.3);
  };
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, Math.max(0, ms));
    timers.add(id);
  };

  return {
    engine(speed) {
      const bus = vehicle === "bus";
      engineOsc.frequency.setTargetAtTime((bus ? 34 : 46) + speed * (bus ? 40 : 62), ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(speed > 0.02 ? 0.05 + speed * 0.07 : 0.018, ctx.currentTime, 0.15);
    },
    step: () => burst(ctx.currentTime, 520, 0.07, 0.07),
    door() { burst(ctx.currentTime, 1400, 0.14, 0.08); burst(ctx.currentTime + 0.03, 240, 0.12, 0.1); },
    speak(timings, startsIn, pitch, voiceSeed) {
      const r = random(voiceSeed);
      const first = ctx.currentTime + startsIn;
      timings.forEach((w, i) => {
        const span = (w.end - w.start) / w.syllables;
        for (let s = 0; s < w.syllables; s++) {
          const contour = 1 + 0.1 * Math.sin(i * 0.9 + s) + (r() - 0.5) * 0.08;
          blip(first + w.start + s * span, pitch * contour, Math.max(0.06, span * 0.85), VOICE_LEVEL, Math.floor(r() * 5));
        }
      });
      later(() => duck(true), startsIn * 1000 - 200);
      later(() => duck(false), (startsIn + (timings[timings.length - 1]?.end ?? 0)) * 1000 + 200);
    },
    dispose() {
      clearInterval(ambience);
      extraTimers.forEach(clearInterval);
      timers.forEach(clearTimeout);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(() => { void ctx.close().catch(() => {}); }, 600);
    }
  };
}
