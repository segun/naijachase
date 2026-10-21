# Desktop case desk usability

Implemented 21 October 2026, extending the mobile case improvements to desktop.

## Presentation

The office still uses its monitor frame, green terminal palette, monospaced
headings, keyboard shortcuts and animated arrival. The monitor geometry and
scene timelines are unchanged. A desktop-only stylesheet loaded with the office
improves both the home desk and an active investigation:

- Body text starts at 1 rem, honours the larger-text preference and has no glow.
  Muted labels have higher contrast; controls are at least 44–48 px tall.
- Scanlines are faint and the reading surface no longer flickers or rolls.
  Scene animations, typing and the terminal's opening animation remain.
- A narrower navigation column leaves more room for the case content. Normal
  desktop windows retain independent content scrolling; very narrow monitor
  areas use a single scroll region and compact navigation.
- Witnesses appear as readable rows with a venue image, name, fare/time and a
  clear saved-clue action for interviewed witnesses. Interviewed rows stay legible.
- Profile fields wrap to fit the available content width. Ineligible suspect
  choices stay hidden behind the existing explanation and next action.
- Resume case is the prominent home action when a case is available.

## Navigation and guidance

The sidebar has three main destinations: **Investigate**, **Clues**, **Travel**.
Travel becomes **Catch suspect** at the final hot stop. Clues contains **Witness
accounts** and **Suspect profile** tabs. The floating **More** menu contains
secondary destinations, warrant access and the hint preference.

The same progress-based next-step panel now appears on desktop and mobile.
**Hide hints** and **More → Show next-step hints** share the remembered device
preference. Tool navigation focuses the guide heading, or main content when hints
are hidden. Three interviews lead to Travel; cold trails, final-stop warrants
and weekly transit retain their existing guidance. Assistant route notes remain
at the top of Travel. All commands, costs, clues and server rules are unchanged.

An available assistant is offered as a prominent labelled gold action at the top
of Investigate, with benefits and cost visible before opening its confirmation.
It stays visible when hints are hidden and becomes a compact status once hired.

Issuing a warrant resets the panel scroll and focus to a compact **Find the
hideout** header. The previous application heading, phases and duplicate hint
are removed so raid choices appear sooner. Searched hideouts move below the
unsearched choices. Achievement sharing waits for the raid to finish and the
results page to mount and paint; it cannot interrupt the arrest animation.

Existing L/B/D/T/W shortcuts remain supported; visible sidebar shortcuts match
the active navigation. More remains a modal with focus containment, Close,
Escape and backdrop dismissal.

## Verification

Svelte checks report zero errors and warnings. The web suite has 369 passing
tests; four existing HTTP integration tests are blocked by sandbox `listen EPERM`.
The production build and compressed download budgets pass.

Browser/device visual verification is still pending because the local server and
standalone browser preview were blocked in this session. Before release, check:

1. 1024×768, 1280×720, 1440×900 and a short laptop window, with normal and larger
   text. Verify the monitor frame, main scroll area, navigation and full labels.
2. Start/resume, read the briefing, question witnesses, review accounts, update
   the profile, travel, recover a cold trail, obtain a warrant and finish a case.
3. Hide/restore hints, resize between desktop and mobile, use the L/B/D/T/W/M
   shortcuts, and open More at the bottom of long content.
4. Check ordinary and weekly colour schemes, reduced motion, keyboard focus,
   assistant suggestions, and the existing mobile portrait layout.
