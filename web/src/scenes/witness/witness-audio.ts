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

/** The two main resonances of five vowel sounds, so the babble does not drone on one note. */
const VOWELS: readonly (readonly [number, number])[] = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870]];

function random(seed: number): () => number {
  let s = (seed % 2147483646) + 1;
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
    const [f1, f2] = VOWELS[vowel % VOWELS.length]!;
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

  /** The crowd drops back while the witness speaks so the voice is clear. */
  const duck = (on: boolean) => {
    murmur.gain.setTargetAtTime(murmurLevel * (on ? 0.45 : 1), ctx.currentTime, 0.3);
    chatter.gain.setTargetAtTime(chatterLevel * (on ? 0.45 : 1), ctx.currentTime, 0.3);
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
          blip(first + w.start + s * span, pitch * contour, Math.max(0.06, span * 0.85), 0.085, Math.floor(r() * 5));
        }
      });
      later(() => duck(true), startsIn * 1000 - 200);
      later(() => duck(false), (startsIn + (timings[timings.length - 1]?.end ?? 0)) * 1000 + 200);
    },
    dispose() {
      clearInterval(ambience);
      timers.forEach(clearTimeout);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(() => { void ctx.close().catch(() => {}); }, 600);
    }
  };
}
