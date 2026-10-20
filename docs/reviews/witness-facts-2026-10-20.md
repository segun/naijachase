# Submitted witness facts — 20 October 2026

Reviewed all 150 submitted entries against the live database and the canonical
content, then checked the retained claims against specific primary sources.
The [complete review](witness-facts-2026-10-20.csv) preserves each submitted
claim, its disposition, existing IDs where relevant, retained wording and source.

## Result

- 37 additional playable witness clues and 333 English dialogue variants.
- 36 clues introduce distinct details; the Akwete clue reuses `KN-S2-0054`, an
  existing knowledge entry that had no specific Akwete gameplay witness.
- 52 entries have a useful core already represented. Their additional dates,
  numbers, rankings or interpretations were not automatically accepted as fact.
  These are recorded as `covered_core_hold_extra_detail`, not exact duplicates
  of every part of the submitted sentence.
- Three overlapping entries were merged into retained clues: Biu volcanism
  with Lake Tilla; Ndibe with Unwana beaches; Lower Usuma with Jabi's reservoir
  history.
- 58 entries were held or omitted because their distinctive claims need better
  evidence, need correction, or offer little useful witness material. A hold is
  not a finding that the whole claim is false.

The catalogue now contains 994 atoms and 8,946 English variants. This
fact-addition pass did not rewrite any mission, route, existing atom or existing
wording. A subsequent [venue repair](../witness-selection.md#venue-repair)
reassigns 77 older accounts without changing their facts or wordings. No new duplicate rows
were added to `knowledge.csv` or `clue-formulations.csv`; gameplay reads the
witness atoms and variants directly.

## Duplicate-check evidence

A read-only `export-mysql` from the production host matched all four relevant
pre-edit canonical files byte for byte on 20 October 2026:

| Table | Rows before this pass | SHA-256 |
| --- | ---: | --- |
| knowledge | 5,243 | `56008ff8be004a333359e1869b460005bb149457cc52a84ba63e92e2020be99c` |
| clue formulations | 12,729 | `e100bfb319093cd3d4c0c61172e39f1a26294b3b4d9c4faa1d756c82f0deda2b` |
| witness atoms | 957 | `a3f1e247b8fc51cf5f56dd1bbd15d727a5b26d6d48ca55e699f70b80230a9d58` |
| dialogue variants | 8,613 | `3f875c10181a8eb67c886f03dc7ad58f035d87d5b8094b2248136cfdbcf5761a` |

Comparison covered the fact itself as well as the attraction's name: an existing
LGA entry does not duplicate a new cultural or geological detail about the same
place. Conversely, rewriting an existing witness fact does not make it new.

## Editorial choices

New atoms use IDs `SCA-R26-<input index>`, preserving the original submission
order rather than renumbering accepted items. Their attached sources support
only the retained wording, not the complete original submission. For example:

- [NICO's NCMM exhibition report](https://nico.gov.ng/minister-commends-ncmm-for-exhibiting-8000-years-old-canoe-in-nigeria/)
  places the Dufuna discovery in modern Yobe. The clue uses Yobe and omits
  disputed precise ages and global rankings. The discovery preceded the
  creation of Yobe State.
- [Bayelsa's culture and tourism account](https://bayelsastate.gov.ng/culture-and-tourism/)
  locates the Lake Efi festival at Sabagrela in Kolokuma/Opokuma, correcting the
  submitted Sagbama location. The clue avoids treating a festival interval as a
  guaranteed current schedule.
- [FCTA's Jabi account](https://www.fcta.gov.ng/ova_por/jabi-lake/)
  describes a reservoir supplying residents before the larger Lower Usuma Dam,
  rather than an entirely excavated lake built only for construction water.
- [UNESCO's Ogbunike description](https://whc.unesco.org/en/tentativelists/5174/)
  describes ten tunnels from the main chamber, rather than ten chambers. The
  existing cave witnesses already cover the useful core, so no new atom was
  added for that entry.
- The Iva Valley clue uses a [contemporary parliamentary record](https://api.parliament.uk/historic-hansard/commons/1949/nov/23/enugu-colliery-nigeria-disturbance)
  only for the strike, shooting and subsequent inquiry. It does not endorse
  the colonial justification in that record or reproduce its early casualty
  figures.

Other sources include state tourism inventories and development plans, museum
collection records, original field studies, conservation operators and company
reports. Where a source only established that a site exists, the dialogue does
not add unsupported geology, military history, dimensions or dates. English
wording has automated checks; no native-speaker or independent human review
is claimed.

All additions are non-landmark alternatives at existing venues. They avoid
the museum venue shared with the mandatory landmark, preserving the existing
three-distinct-venues rule. Gboko cement, Escravos gas processing and Okomu
wildlife are discussed by university researchers because their specialist
venues occur on fewer authored routes. The existing nine-variant convention supplies three
English formulations at each difficulty; these are 37 underlying clues, not
333 distinct facts. The selection system tracks those distinctions.

## Verification

- The catalogue integrity gate passes for all 1,000 cases, 994 atoms and 37
  jurisdictions, including the check against state/capital names in dialogue.
- All 37 new clues have valid combinations on authored routes and were selected
  in the coverage run of eight fresh attempts per mission (8,000 attempts).
  At that point the full catalogue had 917 eligible clues and 916 sampled clues;
  the 77 older structural exclusions were addressed in the subsequent venue repair.
- This fact-addition pass preserved existing canonical rows byte for byte; all added IDs are
  unique, and every addition has one review record and nine difficulty variants.
- All 11 content tests pass, including independent checks of all 1,000 cases
  and 4,000 generated attempt itineraries.
- Svelte diagnostics report zero errors or warnings; all 358 web tests pass.

## Release

This pass changes repository content only. Production content records have not
been imported and the running API has not been restarted. Deploy the updated
content through the normal release process and restart the API to load it;
database import alone does not refresh its in-memory catalogue. New ordinary
and replay attempts can then select these clues without rebuilding the 1,000
cases. Saved attempts and already published weekly plans retain their original
witness accounts. See [witness selection](../witness-selection.md).
