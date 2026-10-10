// Pure presentation helpers for witness pressure, bribe tokens and the disciplinary panel (docs/p391-witness-pressure-api.md).
// The server decides every outcome; nothing here rolls, tallies or changes one.
import type { DisciplinaryCase, GameEvent, PressureMethod, PressureResult } from "../../../contracts/typescript/api-v1.ts";

export type { DisciplinaryCase, JailStatus, PressureAttemptRecord, PressureMethod, PressureResult, TokenBalance, TokenLedgerEntry } from "../../../contracts/typescript/api-v1.ts";

/** Published rules. Shown before confirmation; a server rule change must change these figures too. */
export const PRESSURE_RULES: Record<PressureMethod, { label: string; verb: string; cost: number; risk: string; offence: string }> = {
  bribe: { label: "Bribe", verb: "bribe", cost: 1, risk: "1 in 5 (20%)", offence: "witness tampering" },
  intimidate: { label: "Intimidate", verb: "intimidate", cost: 0, risk: "1 in 2 (50%)", offence: "excessive use of force" }
};

export const MAX_TOKENS_HELD = 20;

export const tokenCost = (method: PressureMethod): string => {
  const cost = PRESSURE_RULES[method].cost;
  return cost === 0 ? "Free" : `${cost} bribe token${cost === 1 ? "" : "s"}`;
};

export const canAfford = (method: PressureMethod, balance: number): boolean => balance >= PRESSURE_RULES[method].cost;

/** Everything the confirmation must state. It never says whether this witness holds an extra clue. */
export function pressureWarnings(method: PressureMethod, balance: number): string[] {
  const rule = PRESSURE_RULES[method];
  const chance = method === "bribe" ? "1-in-5" : "1-in-2";
  const lines = [
    method === "bribe"
      ? `Spend one earned bribe token to press this witness for more information? This witness may have nothing further to reveal. An unsuccessful bribe constitutes witness tampering and carries a ${chance} chance of detection. You can only pressure this witness once.`
      : `Intimidate this witness for more information? This witness may have nothing further to reveal. Unnecessary intimidation constitutes excessive use of force and carries a ${chance} chance of detection. You can only pressure this witness once.`,
    `Cost: ${tokenCost(method)}. Your balance: ${balance} token${balance === 1 ? "" : "s"}${rule.cost ? `, ${Math.max(balance - rule.cost, 0)} afterwards` : ""}.`,
    "A detected offence goes to a five-member panel that can punish you with lost points, demotion or, for a Rookie, 24 hours in jail."
  ];
  if (rule.cost) lines.push("The token is spent even if the witness has nothing to add. Tokens are earned only by playing and cannot be bought or refunded.");
  return lines;
}

const COMPONENT_LABEL: Record<string, string> = {
  first_completion: "First completion",
  "clean_route": "No wrong travel",
  ethical_investigation: "No bribery or intimidation",
  high_difficulty: "High-difficulty case"
};
export const componentLabel = (key: string): string => COMPONENT_LABEL[key] ?? key.replaceAll("_", " ");

export type TokenAward = { reason: string; reasonLabel: string; amount: number; balanceAfter: number; components: string[] };

const REASON_LABEL: Record<string, string> = {
  case_completion: "Case completed", first_completion: "First completion", achievement: "Achievement", witness_pressure: "Witness bribed"
};
export const reasonLabel = (reason: string): string => REASON_LABEL[reason] ?? reason.replaceAll("_", " ");

/** Reads the `token_awarded` events of an arrest response, exactly as the server reported them. */
export function tokenAwards(events: GameEvent[]): TokenAward[] {
  return events.filter(e => e.event_type === "token_awarded").map(e => ({
    reason: e.data.reason ?? "",
    reasonLabel: reasonLabel(e.data.reason ?? ""),
    amount: Number(e.data.amount ?? 0),
    balanceAfter: Number(e.data.balance_after ?? 0),
    components: (e.data.components ?? "").split(",").filter(Boolean).map(componentLabel)
  }));
}

export const tokensEarned = (n: number): string => `${n} bribe token${n === 1 ? "" : "s"} earned`;
export const totalAwarded = (awards: TokenAward[]): number => awards.reduce((sum, a) => sum + a.amount, 0);

/** The server stores UTC as "YYYY-MM-DD HH:MM:SS"; accept ISO too. */
export function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
}
export const formatWhen = (value: string): string => parseUtc(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function jailRemaining(until: string, now: Date): string {
  const ms = parseUtc(until).getTime() - now.getTime();
  if (!(ms > 0)) return "Released";
  const minutes = Math.ceil(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min left` : `${minutes} min left`;
}

const PUNISHMENT_LABEL: Record<DisciplinaryCase["punishment"], string> = {
  none: "Warning only", points_deducted: "Career points deducted", demoted: "Demoted", jailed: "Jailed for 24 hours"
};
export const punishmentLabel = (p: DisciplinaryCase["punishment"]): string => PUNISHMENT_LABEL[p];

export const offenceLabel = (offence: DisciplinaryCase["offence"]): string => offence === "witness_tampering" ? "Witness tampering" : "Excessive use of force";

export const tally = (votes: DisciplinaryCase["votes"]): { punish: number; warning: number } => ({
  punish: votes.filter(v => v === "punish").length, warning: votes.filter(v => v === "warning").length
});

/** What the panel decided, in plain words, from the server's own figures. */
export function consequenceLines(panel: DisciplinaryCase, now = new Date()): string[] {
  if (panel.decision === "warning") return ["The panel is releasing you with a warning. No points, rank or time were taken, but the offence stays on your record."];
  const lines: string[] = [];
  if (panel.punishment === "jailed") {
    lines.push("As a Rookie you are suspended from missions for 24 hours, and this case is forfeited.");
    if (panel.jailed_until) lines.push(`Released ${formatWhen(panel.jailed_until)} (${jailRemaining(panel.jailed_until, now)}).`);
  }
  if (panel.points_after < panel.points_before) lines.push(`Career points: ${panel.points_before.toLocaleString()} → ${panel.points_after.toLocaleString()} (−${(panel.points_before - panel.points_after).toLocaleString()}).`);
  if (panel.new_rank !== panel.old_rank) lines.push(`Rank: ${panel.old_rank} → ${panel.new_rank}.`);
  if (panel.repeat_offender) lines.push("This judgement is final and can not be appealed.");
  return lines;
}

export type PanelStep = { kind: "arrive" | "vote" | "decision"; position: number; vote?: "punish" | "warning" };

/** The reveal order: five arrivals, five votes in the order the server returned them, then the decision. */
export function panelSteps(panel: DisciplinaryCase, events: PressureResult["events"] = []): PanelStep[] {
  const votes = events.filter(e => e.event_type === "panel_vote");
  const list: PanelStep[] = [];
  const seats = votes.length || panel.votes.length;
  for (let i = 1; i <= seats; i++) list.push({ kind: "arrive", position: i });
  const ordered = votes.length
    ? votes.map((e, i) => ({ position: Number(e.data.panel_position ?? i + 1), vote: e.data.vote === "punish" ? "punish" as const : "warning" as const }))
    : panel.votes.map((vote, i) => ({ position: i + 1, vote }));
  for (const v of ordered) list.push({ kind: "vote", position: v.position, vote: v.vote });
  list.push({ kind: "decision", position: 0 });
  return list;
}

/** Whether a rejected pressure attempt means the witness was already pressured (the other method is locked too). */
export const alreadyPressured = (status: number, code: string, message: string): boolean =>
  status === 422 && code === "invalid_command" && /already been pressured/i.test(message);
