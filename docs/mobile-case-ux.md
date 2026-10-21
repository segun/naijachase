# Mobile case experience

Implemented 21 October 2026. This addresses the reported mobile onboarding failure:
players could not read the terminal comfortably or tell which action would move a case forward.

## Navigation and reading

At widths up to 960 px, the office terminal becomes a full-screen app surface with
system type at a 16 px base (respecting the larger-text preference), normal sentence
case, high-contrast copy, and no scanlines, flicker or text glow. Desktop retains its
CRT presentation with improved readability; see `desktop-case-ux.md`. The content
has one scrolling area; the main navigation stays outside it.

The three persistent destinations are **Investigate**, **Clues**, and **Travel**.
Travel becomes **Catch suspect** at the final hot stop. Clues contains two labelled
tabs: witness accounts and suspect profile. The **More** menu still exposes the
warrant screen and account destinations. Witness pressure and cooperation tools
sit behind a disclosure, and install/fullscreen controls now live in Game options
alongside music and scene detail during play.

When available, **Hire an assistant** is a full-width gold action at the very top
of Investigate, above hints and witness choices, on mobile and desktop. It names
the main benefits and server-provided cost; tapping it opens the existing
confirmation before any money is spent. A labelled action replaces the tiny info
icon, so flashing is unnecessary. Once hired, a compact status replaces the offer.
Hiding next-step hints does not hide the assistant action. Weekly availability is
unchanged. The initial briefing's witness-selection screen also shows the offer
above the witness choices, before the first interview closes hiring eligibility.

**More** opens a native modal in the browser's top layer on mobile and desktop,
centred in the viewport independently of the terminal scroll position. The menu
has a bounded, independently scrolling list with its heading and Close button
always visible. Close, Escape and tapping the backdrop dismiss it; selecting a
destination closes it before navigation. Keyboard focus stays inside while open
and returns to the opener on dismissal without scrolling the case content.

The investigation help disclosure always contains the basic case-solving steps
and guidance for the current stop, even before the first interview and when no
assistant, witness-pressure or cooperation tools are available. It must never
expand into an empty panel. When a next-step action is available, the help panel
links directly to it.

Witness actions are labelled **Intimidate** and **Bribe**, with the balance shown
as **Bribe Tokens: X**. The Bribe button omits its cost suffix; the confirmation
terms still explain the cost before the action is submitted.

Each tool starts with a short next-step instruction. `case-guide.ts` derives this
from public case progress only: it does not infer the correct destination, select
a suspect, reveal the key witness, or submit commands. It handles fresh stops,
already questioned witnesses, cold trails, weekly transit, incomplete profiles,
warrants and hideouts. Tool changes reset the terminal's internal scroll and focus
the instruction heading on both mobile and desktop. Both layouts use the same
guidance and Clues/profile tabs.

Players can choose **Hide hints** in the next-step panel and restore it using
**More → Show next-step hints**. The preference is remembered on the device;
when storage is blocked it still lasts for the current session. With hints hidden,
tool changes focus the main content instead. On-demand investigation help remains
available. After all three distinct witnesses at the current stop are questioned,
Investigation, Clues and the profile guide offer **Choose next destination**,
leading to Travel. Cold-trail recovery, weekly transit and final-stop arrest
guidance retain priority.

Travel initially shows the searchable state list on mobile; the map remains
available. A full profile no longer sends players to request a warrant before the
final hot stop. The server still validates the key witness and all warrant rules.
Disabled suspect choices stay hidden on mobile until the profile and final-stop
requirements are met.

After a warrant is issued, the terminal resets both scroll containers to the top
and focuses **Find the hideout**. The reset tracks the warrant state as well as
the route. Its compact header names the suspect and gives one instruction;
the application heading, phase tracker, issued stamp and duplicate next-step
panel are omitted. Unsearched hideouts appear first; searched hideouts remain
disabled at the bottom, preserving server order within each group.

When an assistant is hired, **Assistant’s route notes** appears directly below
the Travel heading, above the map/list controls and destinations, with a prominent
**Ask assistant** button. Suggested destinations can be selected to inspect fares;
the player must still confirm transport before travelling.

## Animations in portrait

Office, garage, witness, journey and raid animations remain in place. Portrait
canvases have a bounded landscape-shaped viewing area, rather than occupying the
entire tall screen. Witness and raid captions occupy their own scrollable area
below the picture. The garage's fare panel is height-bounded and scrollable, so
transport actions remain reachable on short screens. Landscape retains the existing
scene arrangement. Renderer selection and pure scene timelines are unchanged.

Witness animation pauses after the account is spoken and stays open for exploration.
**Read clue** opens the full saved account in a scrollable drawer; **Back to looking
around** closes the drawer without rebuilding the scene. **Return to office** plays
the departure and opens the case desk exactly once. Reading, looking around and
returning never repeat the interview or charge more game time. On phones the clue
drawer and return controls sit beneath the landscape-shaped picture. Keyboard users
can use arrow keys to look around and **Sponsors & ad spaces** to inspect posters.

Office, garage and witness scenes now also render at Simple detail in Canvas 2D,
using their shared pure timeline; 3D failure resumes there. If both renderers fail,
the readable clue and explicit return remain available. There is no intervening
office return animation or second Continue button after leaving a witness, and a
finished case still opens its results. See [advertising.md](advertising.md).

Achievement share prompts stay queued during raid preparation and gameplay
animations. When the raid finishes (or the player skips it), Results mounts and
gets a browser paint before its queued share prompt can open. Leaving Results
cancels pending presentation and clears its readiness. Manual sharing from the
career desk still works.

## Verification and release gate

- Svelte diagnostics: zero errors and warnings.
- Web suite: 369 of 373 tests passed, including eight progress-guidance tests,
  two hint-preference tests, witness-return coverage and four raid/presentation tests.
  Four existing HTTP integration tests cannot start their loopback servers in the
  current sandbox (`listen EPERM`); these are blocked, not verified passes.
- Production build and all compressed download budgets passed.
- Browser/device QA is outstanding. Local dev servers were blocked, and the
  browser security policy also rejected the standalone file preview. No visual
  verification or physical-device completion claim is made for this pass.

Before release, use iPhone Safari and Android Chrome at 320×568, 393×852 and
852×393 (including browser chrome, installed mode, rotation and larger text):

1. Start/resume an ordinary case; reach every witness and transport choice by touch.
2. Watch a portrait witness scene, read a long account, and continue once. Repeat
   using Read full clue during loading and animation, then test a 3D failure.
3. Review accounts, record all profile fields, travel, recover from a cold trail,
   request a warrant at the final stop, raid an empty hideout, and finish a case.
4. Confirm safe areas, focus, text size, scrolling and the three navigation buttons
   on the shortest viewport, plus the desktop CRT at 1280×800.
5. Check weekly transit: notebook remains available, commands stay server-gated,
   and reading/watching never shortens the real wait.
6. Re-run the four blocked integration tests in an environment allowing loopback.
7. Hide hints, switch tools, return from a witness and reload; restore hints from
   More. Interview all three witnesses and follow the Travel hint. With an assistant
   hired, check that route notes appear above the destination list and that selecting
   a suggestion opens its fare confirmation without travelling immediately.
8. Scroll Travel and Clues to the bottom, then open More. Confirm the menu is
   visible without scrolling the page, including in short landscape viewports.
   Scroll to its final action, dismiss with Close, backdrop and Escape, and check
   keyboard focus, navigation, hint toggling and the Abandon confirmation.
9. Submit a warrant from the bottom of the form; verify the hideout header is
   focused at the top and the first choices are visible. Raid an empty location
   and check it moves below the remaining choices. On a winning raid, verify the
   full animation, then Results, then the share modal; also test Skip,
   reduced-motion Continue, slow results loading and leaving Results immediately.

After release, compare first-case completion and the screens where mobile players
leave with the previous version. Better completion is the goal, not an outcome
established by this implementation alone.
