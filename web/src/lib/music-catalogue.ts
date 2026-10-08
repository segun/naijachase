// The names of the game's tunes. This file is deliberately tiny: the picker needs the list up front, while the scores
// and the synthesiser (music-score.ts, music-engine.ts) load only when the music actually starts.
export type TrackInfo = { readonly id: string; readonly name: string; readonly mood: string };

export const TRACK_INFO = [
  { id: "night-pursuit", name: "Night Pursuit", mood: "Brooding thriller" },
  { id: "lagos-nights", name: "Lagos Nights", mood: "Afrobeat groove" },
  { id: "highlife-sunrise", name: "Highlife Sunrise", mood: "Bright guitar highlife" },
  { id: "smoke-and-mirrors", name: "Smoke and Mirrors", mood: "Slow jazz noir" },
  { id: "harmattan-dawn", name: "Harmattan Dawn", mood: "Calm ambient" },
  { id: "express-to-kano", name: "Express to Kano", mood: "Fast driving chase" },
  { id: "market-day", name: "Market Day", mood: "Playful and bouncy" },
  { id: "neon-circuit", name: "Neon Circuit", mood: "Synthwave arpeggios" },
  { id: "midnight-heist", name: "Midnight Heist", mood: "Tense and minimal" },
  { id: "victory-lap", name: "Victory Lap", mood: "Triumphant anthem" }
] as const satisfies readonly TrackInfo[];

export const DEFAULT_TRACK_ID: string = TRACK_INFO[0].id;

export const isTrackId = (id: string | null): id is string => TRACK_INFO.some(t => t.id === id);
