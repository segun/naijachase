# Case difficulty

New attempts use the authored mission difficulty, from 1 to 5. Difficulty
changes the deduction puzzle and the cash available for mistakes; it does not
change assignment into a progression ladder.

| Level | Witness support | Spare transport budget |
| --- | --- | ---: |
| 1 — Easy | Two ambiguous accounts and a landmark account with explicit destination confirmation from a fictional travel record | 80% |
| 2 — Standard | Two ambiguous accounts and a landmark account, without destination confirmation | 60% |
| 3 — Medium | Three ambiguous accounts from the lowest ambiguity band | 40% |
| 4 — Challenging | Three ambiguous accounts from the middle ambiguity band | 30% |
| 5 — Hard | Three ambiguous accounts from the highest ambiguity band | 20% |

All three accounts use distinct venues available at the current stop. Their
candidate-set intersection must identify exactly the intended destination.
At levels 3–5, no account is a standalone landmark clue and every individual
candidate set contains multiple jurisdictions. A pair can sometimes resolve
the destination; Hard prefers combinations that leave more possibilities
after two accounts, but does not promise that all three are always necessary.
All accounts remain truthful. No new real-world facts are invented.

For each origin/destination, score valid ambiguous triples lexicographically by
the smallest pair intersection, the sum of all three pair intersections, and
the total individual candidate count. Split the distinct scores into ordered
thirds. Medium, Challenging and Hard select within the respective band. This
measures remaining destination possibilities rather than sentence length or
cosmetic wording. If future content supplies fewer than three distinct scores,
use the nearest available band; reserves still distinguish the levels. Missing
valid puzzles fail case construction rather than silently inserting a giveaway.

Within the appropriate band, prefer unheard clues, then avoid repeats in the
same attempt, then prefer older exposure; the fresh seed breaks ties. English
wording still uses easy (levels 1–2), medium (3), or hard (4–5) variants. Easy's
travel-record confirmation is appended to the saved landmark dialogue; its
variant ID continues to identify the underlying authored account for history.

Each difficulty's allocation uses the maximum conservative transport baseline
among missions at that difficulty, adds the reserve above, and rounds up to
₦5,000. The baseline funds flights along the correct route, the three most
expensive local drives at every stop, and apprehension. Easier cases therefore
allow more paid detours; Hard retains at least the previous 20% reserve.
Every level keeps eight stops, eight dossier fields, all 36 other jurisdictions
on the web travel map, and the seven-day deadline. Scoring and fares are unchanged.

## Assignment and saved attempts

Ordinary assignment remains server-random among published missions the player
has not solved, with the existing preference for newly published content.
Player rank does not select the difficulty. The database excludes successful
mission completions and concurrent active assignments under the player lock.
Solving a case removes it from future ordinary assignment; an explicit archive
replay remains available. Failure or abandonment does not count as solving it.

Only new attempts get the new plan and allocation. Saved witness plans and
economy balances remain authoritative for resumed ordinary, replay and weekly
attempts. Legacy attempts without a witness plan keep their original selector.
New weekly templates save one shared plan and allocation for every entrant.
The terminal also saves difficulty-specific plans for new games.

## Verification

The content tests check all 1,000 cases for seeded variation, local venues,
wording and unique complete intersections, and check ordered ambiguity bands
for every jurisdiction. API tests exercise multiple seeds per case and actual
venue hours, transport, dossier, warrant and apprehension commands. The live
database regression verifies that a solved case cannot be assigned ordinarily
again while an explicit replay remains possible. These are automated
solvability checks, not a substitute for playtesting perceived difficulty.
