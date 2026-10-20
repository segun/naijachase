# Witness selection and content coverage

New ordinary and replay attempts choose their own witness plan from the loaded
catalogue. The 1,000 mission stories and routes do not need rebuilding when
clues are added. Content files must be deployed and the API restarted: the API
loads the CSV catalogue once at startup, independently of the database import.

## Selection and consistency

For each stop, enumerate combinations with three distinct, locally available
venues: one curated landmark clue and two non-landmark clues. Both ambiguous
clues must include the destination, and their intersection must reduce the
options. The landmark witness never supplies the key suspect-profile trait.

Choose combinations by preferring fewer previously heard clues, avoiding repeats
within the same attempt where possible, then preferring older exposure times.
A hash of the fresh attempt seed breaks ties. After choosing the underlying
clue, prefer unheard English wording at the mission's difficulty, then older
wording. A new formulation of a familiar clue does not count as a new clue.

The private `GameState.witness_plan` stores every stop's selected clue IDs,
wording, roles, candidate sets, venue IDs and supplemental pressure dialogue.
Refreshes, retries, resumes and catalogue updates reuse that snapshot. Public
case state and interview responses never expose the plan or clue IDs: some IDs
contain the hidden destination's name. Recorded accounts retain their original
words. A new weekly challenge saves one shared plan in its template and copies
it to every entrant, without applying individual player history.

Older attempts without `witness_plan` deserialize successfully and continue
using the existing mission/stop selector. The new snapshot guarantee applies to
attempts created after this release; no ongoing investigation is reset.

## History

Existing interview receipts are the source of truth, requiring no new database
schema or history writes. At assignment, the server joins actual hot-trail
`witness_account` events to their saved stage's private plan, returning grouped
clue/wording IDs and the latest exposure time. Ordinary and replay receipts
count even if the case was later abandoned. Weekly receipts count only after
their interview journey completes. Offered but unvisited witnesses, cold-trail
replies, and unfinished weekly journeys do not count. Duplicate commands reuse
their existing receipt. Queries are restricted to the owning player.

Historical receipts without a saved plan cannot reliably identify their clue
IDs, so they do not seed this history. Tracking begins with interviews in new
planned attempts. The history query runs on case creation, not on every move.

## Coverage report

Run `make witness-coverage` to write `build/witness-coverage.csv`. To choose an
output and sample size, run:

```sh
cargo run --manifest-path rust/Cargo.toml -p naijachase-tools -- witness-coverage build/witness-coverage.csv 8
```

The report lists every atom, state, venue, eligible authored stops, legacy
selection count, sampled selection count and structural exclusion reason.
Structural eligibility exhaustively checks valid combinations on authored
routes. Sampling uses eight fresh attempts per mission with empty player
history; zero sampled uses alone does not mean a clue is unreachable. These are
catalogue diagnostics, not measurements of live players' interviews.

The 20 October 2026 audit found 880 of 957 clues structurally eligible, compared
with 835 chosen by the legacy selector. Eight sampled attempts per mission used
879 clues. Of the 250 clues added on 19 October, 246 are eligible and all 246
appeared in the sample. The remaining four are:

| Atom | Destination | Venue |
| --- | --- | --- |
| SCA-EVENT-003 | Abia | Museum |
| SCA-EVENT-006 | Ogun | Museum |
| SCA-EVENT-009 | Niger | Museum |
| SCA-EVENT-011 | Kano | Museum |

All 77 structural exclusions share the mandatory landmark witness's venue.
These need an editorial decision about a suitable alternative venue or a future
change to the three-distinct-venues puzzle rule; the selector does not force
them into an invalid combination. New clues and formulations may grow beyond
the current baseline counts without changing the loader's numeric limits.

Validation covers attempt variation, unheard/oldest preference, difficulty,
venue and puzzle validity, private snapshot recovery after content changes,
the 1,000-mission timing/budget simulation, and live MySQL history semantics.
