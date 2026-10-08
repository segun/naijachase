// Pure helpers for the case briefing: the dossier the server returns when a case is opened (see docs/p371-case-assignment-api.md,
// "Ask the server for a new ordinary case"), laid out as rows to be typed onto the terminal one character at a time.
import { DEADLINE_MINUTES, clockParts, dossierCount, money, zoneOf, type CaseResponse } from "../model.ts";

export type Line = { label: string; value: string };

/** Typing takes this long however long the dossier is, so the briefing stays short. */
export const TYPING_SECONDS = 2.6;
export const TICK_MS = 30;

const ATTEMPT: Record<string, string> = { ordinary: "Ordinary", replay: "Replay (no points)", weekly: "Weekly challenge" };
const pips = (difficulty: number) => "\u2605".repeat(Math.max(0, difficulty)) + "\u2606".repeat(Math.max(0, 5 - difficulty));

/** Everything the server says about a freshly opened case, in reading order. Nothing here is computed by the browser beyond formatting. */
export function dossierLines(game: CaseResponse): Line[] {
  const s = game.state;
  const days = Math.round(DEADLINE_MINUTES / 1440);
  const clock = clockParts(s.elapsed);
  const lines: Line[] = [
    { label: "Case file", value: game.case_id },
    { label: "Mission", value: s.mission_id },
    { label: "Attempt", value: ATTEMPT[game.attempt_kind] ?? game.attempt_kind },
    { label: "Difficulty", value: `${pips(s.difficulty)}  (${s.difficulty})` },
    { label: "Starting at", value: [s.current_state, zoneOf(s.current_state)].filter(Boolean).join(" \u00B7 ") },
    { label: "Case clock", value: `${clock.day} ${clock.time} \u00B7 ${days} days to catch the thief` },
    { label: "Score", value: s.score.toLocaleString() },
    ...(typeof s.balance === "number" ? [{ label: "Case funds", value: money(s.balance) }] : []),
    { label: "Career pts", value: s.career_points.toLocaleString() },
    { label: "Dossier", value: `${dossierCount(s.dossier)}/8 details known` },
    { label: "Questioned", value: `${s.visited_venues.length} witnesses` },
    { label: "Warrant", value: s.warrant_suspect ? "Requested" : "Not yet" },
    { label: "Status", value: s.outcome ? s.outcome.replaceAll("_", " ") : "Open" }
  ];
  return lines;
}

export const totalChars = (lines: readonly Line[]) => lines.reduce((n, l) => n + l.label.length + l.value.length, 0);

/** Characters to reveal per tick so the whole dossier is typed in about TYPING_SECONDS. */
export const charsPerTick = (total: number) => Math.max(1, Math.ceil(total / ((TYPING_SECONDS * 1000) / TICK_MS)));

/** The rows visible after `chars` characters have been typed (labels first, then values, row by row). */
export function typedRows(lines: readonly Line[], chars: number): { rows: Line[]; done: boolean } {
  let left = Math.max(0, chars);
  const rows: Line[] = [];
  for (const line of lines) {
    if (left <= 0) break;
    const label = line.label.slice(0, left);
    left -= label.length;
    const value = line.value.slice(0, Math.max(0, left));
    left -= value.length;
    rows.push({ label, value });
  }
  return { rows, done: chars >= totalChars(lines) };
}
