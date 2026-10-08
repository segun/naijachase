# P3.9.2 sellable product catalogue

This document defines what Naija Chase may sell. It does not enable checkout.
Every product is a permanent account entitlement unless explicitly described as
a consumable-free story licence. There are no loot boxes, random paid rewards,
rental timers, paid gameplay currency, or statistical upgrades.

## Governing distinction

The storefront sells **cosmetics and visual upgrades**, never gameplay upgrades.
The word `upgrade` means a richer model, texture, sound, animation, scene, or
authored story. It never means faster travel, a larger case budget, better clues,
easier warrants, more favourable witnesses, lower detection, shorter punishment,
extra score, rank, or competitive advantage. Every catalogue record must declare
`gameplay_effect: none`.

## Launch product families

### 1. Investigator outfits

Full-body civilian appearance sets, available in compatible body presentations:

- Smart Field Investigator — shirt/blouse, trousers, practical shoes and jacket.
- Ankara Field Set — original licensed textile pattern with restrained accessories.
- Senator Set — tailored long tunic and trousers.
- Kaftan Set — regionally reviewed flowing outfit and cap/headwrap options.
- Weekend Plainclothes — polo/top, jeans or chinos and trainers.
- Rain Patrol — raincoat, boots and wet-weather scene variants.
- Harmattan Fieldwear — light coat, scarf and dust-weather variants.
- Evening Investigator — formal evening outfit for hotel, club and event scenes.

These are not disguises. A witness, suspect, venue, or mission never reacts
differently because an outfit is owned or equipped.

### 2. Fictional investigator uniforms

- Naija Chase Rookie Uniform — free default.
- Field Investigator Uniform.
- Senior Investigator Uniform.
- Inspector Dress Uniform.
- Forensics Support Uniform.
- Search-and-Rescue Uniform.
- Heritage Protection Unit Uniform.

Uniforms use fictional Naija Chase insignia and cannot reproduce restricted or
deceptively realistic Nigerian security-service uniforms, ranks, badges, or IDs.
Owning a senior-looking uniform does not grant the corresponding career rank.

### 3. Avatar accessories

- Eyewear: clear frames, sunglasses and protective field glasses.
- Headwear: original caps, hats, headwraps and culturally reviewed regional styles.
- Field bags: satchel, backpack, document case and camera bag.
- Wrist items: watches and bracelets.
- Investigation props: notebook cover, pen set, camera skin and torch skin.
- Identity accents: fictional lapel pins, rank-neutral badges and supporter pin.

Weapons, real service credentials, political campaign material, religious
vestments used as costumes, and accessories that imply clue utility are excluded.

### 4. Cosmetic vehicles

Vehicles are skins selected for an already-authorised renderer-neutral journey:

- Road: compact saloon, classic saloon, estate car, SUV, pickup, minibus and
  electric concept car.
- Air: commuter turboprop, classic propeller aircraft and modern regional jet.
- Water, where the scene supports it: wooden river boat, ferry and patrol-style
  fictional utility boat.
- Local scene accents: motorcycle, bicycle and tricycle appearances only when
  the underlying event and geography permit them.

Every skin uses the server's existing mode, fare, route and duration. A purchased
aircraft cannot turn driving into flying; a sports-looking car is not faster; a
boat is never shown on a land-only route. Real transport brands and logos are not
sold without a separately reviewed licence and sponsorship disclosure.

### 5. Visual themes

- Case Desk Classic — free default.
- Newsroom Investigation.
- Evidence Board.
- Retro Terminal.
- Lagos Night.
- Sahel Dawn.
- Rainforest Green.
- Niger–Benue Confluence.
- Harmattan Paper.
- Nigerian Modernism.

Themes may change scene dressing, colour, texture, HUD framing, typography,
ambient sound and menu music. Every theme must preserve contrast, large text,
keyboard focus, subtitles, reduced motion and the semantic DOM alternative.

### 6. Animation products

Single animations and clearly itemised bundles may replace presentation for:

- investigator entrance and case acceptance;
- notebook opening, clue recording and dossier completion;
- witness greeting and interview reaction;
- road, air and water departure/arrival;
- warrant approval;
- hideout search and non-graphic arrest;
- rank-up, achievement and weekly-challenge celebration.

Pressure, disciplinary, jail, failure and accessibility-critical animations are
not monetised. Paid animation cannot delay a command, hide text, reveal hidden
information, intensify violence, or make an outcome appear different.

### 7. Animation bundles

- Fieldwork Bundle — entrance, notebook and witness animations.
- Travel Bundle — road, air and eligible water sequences.
- Case Closure Bundle — warrant, search, arrest and results sequences.
- Celebration Bundle — rank, achievement and weekly-challenge sequences.

Bundles disclose every included item. Owners cannot be charged twice for an
item they already own; checkout must block or reduce the bundle price according
to the eventual provider-supported pricing policy.

### 8. Optional story packs

Story packs add authored cases but no easier rules or exclusive progression:

- Kingdoms and Empires — historic states, trade routes and material culture.
- Independence Files — constitutional development and independence-era cases.
- Rivers, Creeks and Confluences — waterways, ports and river communities.
- Arts, Music and Literature — creators, movements, venues and cultural history.
- Festivals Across Nigeria — carefully reviewed festival and masquerade stories.
- Wildlife and Wild Places — parks, wetlands, forests, mountains and conservation.
- Industry and Invention — agriculture, manufacturing, minerals, energy and tech.
- Cities After Dark — urban night venues and night-time investigation chains.

Each pack should contain a declared number of complete missions, remain manually
replayable, and pass the same editorial, sensitivity, clue, dossier, deadline,
budget, no-place-name, accessibility and simulation gates as the base catalogue.
Purchasing a pack does not count as solving it and does not grant points or tokens.
Sensitive history packs require specialist editorial review before sale.

### 9. Supporter editions

- Supporter Edition — supporter profile pin, credits acknowledgement (opt-in),
  one exclusive theme and a documented cosmetic bundle.
- Founding Supporter Edition — time-bounded at launch, with a founding pin,
  theme variant and cosmetic bundle; no gameplay or permanent leaderboard status.

Supporter editions are transparent bundles, not donations unless the legal and
tax treatment genuinely supports that wording. They never include hidden future
benefits or preferential support outcomes.

### 10. Clearly labelled sponsorships

Sponsored cosmetics may include a licensed vehicle skin, outfit, venue dressing,
theme or story collaboration. Every preview, product page and equipped-item
record identifies the sponsor. Sponsorship cannot influence clue truth, mission
difficulty, placement, disciplinary outcomes, or a player's recommendation feed.

## Free defaults and excluded products

Every slot has a permanent free default: avatar, civilian outfit, Rookie uniform,
accessories, vehicle presentation for each supported mode, theme and essential
animation. The complete base 1,000-case catalogue remains playable without a
purchase.

The initial storefront must not sell:

- bribe, intimidation, challenge or case-budget currency;
- clues, dossier traits, warrants, witness selection or answer checking;
- faster vehicles, shorter real/simulated travel, deadline extensions or retries;
- score, career points, rank, achievements or weekly-challenge advantages;
- lower detection, panel votes, warnings, sentence reduction or offence removal;
- randomised paid items, loot boxes, paid spins, trading, gifting, resale or cash-out;
- stamina, lives, case slots, save slots, account recovery or accessibility options.

## Catalogue identity and price tiers

Stable product IDs use `NC-{FAMILY}-{NUMBER}`, for example `NC-OUTFIT-0001`,
`NC-VEHICLE-0001`, `NC-THEME-0001`, `NC-ANIM-0001`, `NC-STORY-0001` and
`NC-SUPPORTER-0001`. Products are never renumbered or reused after retirement.

Pricing uses direct fiat amounts, not a purchasable virtual currency. Initial
price bands are defined without amounts until the payment-provider, tax and
launch-market ADR is approved:

- Tier A — single accessory or animation.
- Tier B — outfit, uniform, vehicle skin or theme.
- Tier C — animation/cosmetic bundle.
- Tier D — story pack.
- Tier E — supporter edition.

The eventual catalogue records the complete tax-inclusive display price and ISO
4217 currency. There are no rarity labels or artificial scarcity. A genuine
availability window may be used only for licensed campaigns or the clearly
described Founding Supporter Edition.

## Launch catalogue recommendation

The first production catalogue should stay reviewable: 8 outfits, 7 fictional
uniforms including the free default, 18 accessories, 12 vehicle skins across
eligible modes, 10 themes including the free default, 20 single animations,
4 animation bundles, 2 story packs and 1 supporter edition. Later releases can
expand these families without changing the product model.
