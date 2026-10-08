# P3.9 economy and monetisation guardrails

This policy is authoritative for the Rust engine, API, content pipeline, web
client, and future storefront. `ECONOMY_RULES_VERSION` identifies the ruleset.

## Gameplay currencies

| Currency | Earned | Spent | Limits | Purchasable |
|---|---|---|---|---|
| Case budget | Calculated when a case starts | Authoritative travel and local transport | Case-scoped; no carry-over | Never |
| Career points | Successful play and documented achievements | Not a spendable balance | Existing progression and disciplinary rules | Never |
| Earned bribe tokens | First completion: 1; no wrong travel: +1; no pressure: +1; difficulty 4–5: +1; first `state_explorer`: 2; first `national_investigator`: 5 | Fictional witness-pressure mechanic in P3.9.1 | At most 3 per case and 3 case-earned tokens/day; balance cap 20; replays award zero | Never |
| Challenge tokens | Weekly challenge reward: 5 | Approved cosmetic rewards only | One award/player/week; no transfer or cash-out | Never |

Awards are server-authoritative, ledger-backed, idempotent, and tied to a unique
completion, achievement, or challenge result. Replays, duplicate requests,
failed cases, alternate accounts, automation, collusion, and repeated low-effort
actions do not create repeatable awards. P3.9.1 will implement the bribe-token
ledger and pressure mechanic; this section fixes its economic boundary first.

## Non-negotiable product boundary

Money may buy only presentation or additional authored content: cosmetics,
visual themes, cosmetic vehicle and uniform skins, animations, optional story
packs, supporter editions, and clearly labelled sponsored cosmetics. Every
sellable product must declare `gameplay_effect: none` and pass the Rust policy
validator.

No purchase may change clue accuracy or availability, warrant validity, dossier
progress, routes, fares, opening budget, travel duration, case deadline, score,
rank, career points, bribe-token balance, detection odds, panel votes,
punishment, jail time, weekly resources, eligibility, or competitive outcome.
Vehicles are skins; story packs use the same validation and difficulty rules as
the included catalogue. Corruption remains fictional, consequence-driven, and
entirely disconnected from money.

## Required launch gate

Checkout and advertising stay disabled until a documented, jurisdiction-aware
review has signed off on all of the following:

- prices, taxes, receipts, refunds, cancellation, chargebacks, and customer support;
- clear advertising and sponsorship labels with no behavioural targeting of children;
- age rating, age assurance where required, parental controls, and spending controls;
- privacy, consent, retention, account deletion, analytics, and processor contracts;
- avoidance of loot boxes, paid random rewards, cash-out, trading, wagering, and
  other gambling-like mechanics;
- accessibility of the catalogue, purchase confirmation, receipts, restoration,
  refund route, and non-purchase path;
- web payment-provider and applicable consumer-protection requirements.

Legal approval must record reviewer, jurisdictions, evidence links, policy
version, decision, date, and next-review date. A missing, expired, or rejected
approval means commerce remains disabled. This is a release control, not a claim
that legal review has already occurred.

## Verification

The Rust tests reject every prohibited gameplay effect, ensure sponsored items
must be disclosed, prove no gameplay currency is purchasable, and exercise award
caps and replay resistance. The complete catalogue simulation remains the proof
that all included cases can be completed without purchases. P3.9.2 must retain
these tests when it adds catalogue, entitlement, and checkout persistence.

## Frontend handoff

There is no storefront API in P3.9. The frontend must not display a buy action
for gameplay currency or infer entitlements. When P3.9.2 introduces product
APIs, the UI must render `gameplay_effect: none`, sponsorship labels, full price,
and the accessible non-purchase path exactly as returned by the API.
