// Pure helpers for the case briefing: the dossier the server returns when a case is opened (see docs/p371-case-assignment-api.md,
// "Ask the server for a new ordinary case"), laid out as rows to be typed onto the terminal one character at a time.
import { DEADLINE_MINUTES, clockParts, money, zoneOf, type CaseResponse } from "../model.ts";

export type Line = { label: string; value: string };

/** Typing takes this long however long the dossier is, so the briefing stays short. */
export const TYPING_SECONDS = 4;
export const TICK_MS = 30;

const ATTEMPT: Record<string, string> = { ordinary: "Ordinary", replay: "Replay (no points)", weekly: "Weekly challenge" };

/**
 * The opening case file the server returns when a case is opened (`state.case_dossier`: title, stolen item, premise and opening
 * briefing; see docs/p371-case-assignment-api.md), followed by the facts the player needs to start. `state.dossier`, the suspect
 * profile that fills in later, is a different thing and is never shown here.
 */
export function dossierLines(game: CaseResponse): Line[] {
  const s = game.state;
  const file = s.case_dossier;
  const days = Math.round(DEADLINE_MINUTES / 1440);
  const clock = clockParts(s.elapsed);
  const lines: Line[] = [];
  if (file?.title) lines.push({ label: "Case", value: file.title });
  if (file?.stolen_item) lines.push({ label: "Stolen", value: file.stolen_item });
  if (file?.premise) lines.push({ label: "Premise", value: file.premise });
  if (file?.opening_briefing) lines.push({ label: "Briefing", value: file.opening_briefing });
  lines.push(
    { label: "Starting at", value: [s.current_state, zoneOf(s.current_state)].filter(Boolean).join(" \u00B7 ") },
    { label: "Case clock", value: `${clock.day} ${clock.time} \u00B7 ${days} days to catch the thief` },
    ...(typeof s.balance === "number" ? [{ label: "Case funds", value: money(s.balance) }] : []),
    { label: "Attempt", value: `${ATTEMPT[game.attempt_kind] ?? game.attempt_kind} \u00B7 ${s.mission_id}` }
  );
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
