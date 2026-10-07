import { STEP_SECONDS, BPM, midiToFreq, trackStep, type Hit } from "./music-score.ts";

type Ctx = BaseAudioContext;
export type Bus = { dry: AudioNode; wet: AudioNode; out: AudioNode; noise: AudioBuffer; step: number };

function noiseBuffer(ctx: Ctx): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 1.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
  return buffer;
}

function reverbImpulse(ctx: Ctx): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2.2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 99, low = 0;
  for (let i = 0; i < length; i++) {
    seed = (seed * 16807) % 2147483647;
    low += ((seed / 2147483647) * 2 - 1 - low) * 0.35; // darken the tail so it sounds like a room, not hiss
    data[i] = low * (1 - i / length) ** 2.8;
  }
  return buffer;
}

/** Mixing chain: voices -> soft saturation -> compressor, plus reverb and a dotted-eighth echo send. */
export function buildBus(ctx: Ctx): Bus {
  const out = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.2;
  comp.connect(out);

  const dry = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.6);
  shaper.curve = curve;
  dry.connect(shaper).connect(comp);

  const wet = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = reverbImpulse(ctx);
  const reverbLevel = ctx.createGain();
  reverbLevel.gain.value = 0.55;
  wet.connect(reverb).connect(reverbLevel).connect(comp);

  const echo = ctx.createDelay(2);
  echo.delayTime.value = (60 / BPM) * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass"; tone.frequency.value = 2400;
  const echoLevel = ctx.createGain();
  echoLevel.gain.value = 0.4;
  wet.connect(echo);
  echo.connect(tone).connect(feedback).connect(echo);
  tone.connect(echoLevel).connect(comp);

  return { dry, wet, out, noise: noiseBuffer(ctx), step: STEP_SECONDS };
}

// ---- Voice building blocks -------------------------------------------------

function route(ctx: Ctx, bus: Bus, source: AudioNode, level: number, wet = 0) {
  const gain = ctx.createGain();
  gain.gain.value = level;
  source.connect(gain).connect(bus.dry);
  if (wet > 0) { const send = ctx.createGain(); send.gain.value = wet; gain.connect(send).connect(bus.wet); }
}

function shape(param: AudioParam, t: number, attack: number, peak: number, length: number) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + Math.max(length, attack + 0.02));
}

function osc(ctx: Ctx, bus: Bus, type: OscillatorType, freq: number, t: number, o: {
  length: number; peak: number; attack?: number; cutoff?: [number, number]; detune?: number; wet?: number; vibrato?: number;
}) {
  const source = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  source.type = type;
  source.frequency.setValueAtTime(freq, t);
  source.detune.value = o.detune ?? 0;
  filter.type = "lowpass";
  const [from, to] = o.cutoff ?? [6000, 6000];
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(to, 40), t + o.length);
  shape(env.gain, t, o.attack ?? 0.008, o.peak, o.length);
  if (o.vibrato) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5.5; depth.gain.value = o.vibrato;
    lfo.connect(depth).connect(source.detune);
    lfo.start(t); lfo.stop(t + o.length + 0.1);
  }
  source.connect(filter).connect(env);
  route(ctx, bus, env, 1, o.wet);
  source.start(t);
  source.stop(t + o.length + 0.1);
}

function burst(ctx: Ctx, bus: Bus, t: number, o: { length: number; peak: number; type: BiquadFilterType; freq: number; q?: number; attack?: number; wet?: number; offset?: number }) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  source.buffer = bus.noise;
  filter.type = o.type; filter.frequency.value = o.freq; filter.Q.value = o.q ?? 0.7;
  shape(env.gain, t, o.attack ?? 0.002, o.peak, o.length);
  source.connect(filter).connect(env);
  route(ctx, bus, env, 1, o.wet);
  source.start(t, o.offset ?? 0);
  source.stop(t + o.length + 0.05);
}

const notes = (n: Hit["n"]): number[] => (n === undefined ? [] : typeof n === "number" ? [n] : [...n]);

/** Plays one event at `t`. Works on live and offline contexts. */
export function playHit(ctx: Ctx, bus: Bus, hit: Hit, t: number) {
  const vel = hit.vel ?? 1;
  const len = (hit.len ?? 1) * bus.step;
  const freqs = notes(hit.n).map(midiToFreq);
  const f = freqs[0] ?? 100;

  switch (hit.v) {
    case "kick": {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
      const env = ctx.createGain();
      shape(env.gain, t, 0.003, 0.95 * vel, 0.34);
      o.connect(env);
      route(ctx, bus, env, 1);
      o.start(t); o.stop(t + 0.4);
      burst(ctx, bus, t, { length: 0.02, peak: 0.25 * vel, type: "highpass", freq: 3000 });
      break;
    }
    case "snare":
      burst(ctx, bus, t, { length: 0.2, peak: 0.42 * vel, type: "highpass", freq: 1700, wet: 0.3 });
      osc(ctx, bus, "triangle", 185, t, { length: 0.1, peak: 0.28 * vel, cutoff: [1500, 400] });
      break;
    case "clap":
      for (const d of [0, 0.012, 0.026]) burst(ctx, bus, t + d, { length: d === 0.026 ? 0.16 : 0.03, peak: 0.3 * vel, type: "bandpass", freq: 1300, q: 1.2, wet: 0.45 });
      break;
    case "hat": burst(ctx, bus, t, { length: 0.04, peak: 0.16 * vel, type: "highpass", freq: 7500 }); break;
    case "tick": osc(ctx, bus, "sine", 1900, t, { length: 0.025, peak: 0.12 * vel }); break;
    case "bass":
      osc(ctx, bus, "sawtooth", f, t, { length: len, peak: 0.3 * vel, cutoff: [1300, 220] });
      osc(ctx, bus, "sine", f, t, { length: len * 1.1, peak: 0.3 * vel });
      break;
    case "stab":
      for (const q of freqs) for (const d of [-9, 9]) osc(ctx, bus, "sawtooth", q, t, { length: len, peak: 0.022 * vel, cutoff: [2600, 600], detune: d, wet: 0.35 });
      break;
    case "pad":
      for (const q of freqs) for (const d of [-8, 8]) osc(ctx, bus, "sawtooth", q, t, { length: len, peak: 0.02 * vel, attack: 0.9, cutoff: [700, 500], detune: d, wet: 0.5 });
      break;
    case "lead": osc(ctx, bus, "sawtooth", f, t, { length: len, peak: 0.1 * vel, attack: 0.04, cutoff: [2400, 1500], vibrato: 7, wet: 0.45 }); break;
    case "hit": {
      burst(ctx, bus, t, { length: 1.4, peak: 0.45 * vel, type: "lowpass", freq: 900, wet: 0.6 });
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.7);
      const env = ctx.createGain();
      shape(env.gain, t, 0.005, 0.5 * vel, 1.1);
      o.connect(env);
      route(ctx, bus, env, 1, 0.2);
      o.start(t); o.stop(t + 1.2);
      break;
    }
    case "riser": {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();
      source.buffer = bus.noise; source.loop = true;
      filter.type = "bandpass"; filter.Q.value = 1.5;
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.exponentialRampToValueAtTime(7000, t + len);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.16 * vel, t + len);
      env.gain.linearRampToValueAtTime(0.0001, t + len + 0.05);
      source.connect(filter).connect(env);
      route(ctx, bus, env, 1, 0.2);
      source.start(t); source.stop(t + len + 0.1);
      break;
    }
  }
}

export function scheduleStep(ctx: Ctx, bus: Bus, index: number, time: number) {
  for (const hit of trackStep(index)) playHit(ctx, bus, hit, time);
}

/** Renders `steps` steps offline; used to verify the track produces bounded, audible sound. */
export async function renderTrack(steps: number, sampleRate = 22050): Promise<Float32Array> {
  const seconds = steps * STEP_SECONDS + 3;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const bus = buildBus(ctx);
  bus.out.connect(ctx.destination);
  for (let i = 0; i < steps; i++) scheduleStep(ctx, bus, i, i * bus.step);
  return (await ctx.startRendering()).getChannelData(0);
}

export class ScorePlayer {
  private ctx: AudioContext | null = null;
  private volume: GainNode | null = null;
  private bus: Bus | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextStep = 0;
  private nextTime = 0;
  private wanted = false;
  private readonly level = 0.55;

  get running(): boolean { return this.timer !== undefined; }

  async start() {
    this.wanted = true;
    if (this.running) return;
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx ??= new AudioCtor();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.wanted || this.running) return;
    const ctx = this.ctx;
    this.volume ??= (() => { const g = ctx.createGain(); g.connect(ctx.destination); return g; })();
    this.build();
    const volume = this.volume;
    volume.gain.cancelScheduledValues(ctx.currentTime);
    volume.gain.setValueAtTime(0.0001, ctx.currentTime);
    volume.gain.exponentialRampToValueAtTime(this.level, ctx.currentTime + 1.5);
    this.nextStep = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  private build() {
    if (!this.ctx || !this.volume) return;
    this.bus?.out.disconnect();
    this.bus = buildBus(this.ctx);
    this.bus.out.connect(this.volume);
  }

  private schedule() {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    while (this.nextTime < ctx.currentTime + 0.25) {
      scheduleStep(ctx, bus, this.nextStep, this.nextTime);
      this.nextStep++;
      this.nextTime += bus.step;
    }
  }

  /** Fades out, then stops scheduling and releases the audio device. */
  stop(fadeSeconds = 1) {
    this.wanted = false;
    const { ctx, volume } = this;
    if (this.timer === undefined || !ctx || !volume) return;
    clearInterval(this.timer);
    this.timer = undefined;
    volume.gain.cancelScheduledValues(ctx.currentTime);
    volume.gain.setValueAtTime(Math.max(volume.gain.value, 0.0001), ctx.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fadeSeconds);
    setTimeout(() => { if (this.timer === undefined && !this.wanted) void ctx.suspend(); }, fadeSeconds * 1000 + 100);
  }
}
