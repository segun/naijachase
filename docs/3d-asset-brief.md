# 3D asset brief (GLB) for a 3D artist

Everything in the web game's 3D scenes is currently built in code from boxes, cylinders, spheres and lofted shapes (Babylon.js).
This brief lists every model, rig, animation and texture needed to replace that with authored GLB assets, so it can be quoted as one job.
It was compiled from the scene code in `web/src/scenes/` and `web/src/avatar/`.

Quantities marked **~** are estimates from the code (variants are seeded per account, so more variety is a bonus, not a requirement).
Tiers: **A** = needed for the game to look right, **B** = strongly improves it, **C** = polish.

---

## 0. Technical specification (applies to everything)

| Item | Requirement |
| --- | --- |
| Format | glTF 2.0 binary (`.glb`), Y-up, 1 unit = 1 metre, forward = -Z (the figure faces -Z at rest), origin at the feet or base centre |
| Materials | glTF PBR metallic-roughness. Keep to few materials per asset (ideally 1-3). Share atlases within a kit |
| Textures | Power-of-two, max 1024 px for props and 2048 px for hero vehicles and bodies. Keep a separate base-colour only fallback |
| Compression | Meshopt or Draco geometry compression; KTX2/Basis textures if possible. Budget below |
| Naming | Stable, documented node names (code finds nodes by name, e.g. `wheel_fl`, `door`, bones). Provide a naming sheet |
| Skeleton | **One** shared humanoid skeleton for every person (same bone names, same rest pose, T-pose or A-pose). Animation clips must work on all bodies |
| LOD | Each character and vehicle: a "high" (desktop) and "low" (weak phone) version, or a decimated LOD1 at ~40% |
| Collision/shadow | No baked shadows in textures. A simple contact-shadow quad is added in code |
| Licence | Original work or fully licensed for commercial use, no third-party brand logos (see `docs/fictional-brands-policy.md`) |
| Delivery | Source files (.blend/.fbx/.max) plus exported GLBs, texture sources, and a preview/turntable for each asset |

Budgets (triangles, per instance): character body 4-6k (LOD1 ~2k), hair piece 300-1.5k, clothing piece 500-2k, prop 100-1.5k,
hero vehicle 8-15k, bus/van 6-10k, building facade module 500-3k, whole venue (all kit pieces in view) under ~120k.
Target download: under ~150 KB per character set after compression, about 1-2 MB per venue kit.

Customisation requirement: characters must be **tintable at runtime**. Use dedicated material slots (named exactly):
`skin`, `hair`, `primary`, `secondary`, `accent` (plus `eyes`, `teeth`) so the game can colour one model for any avatar preset.
Fabric prints (Ankara/wax print) are supplied as tileable textures and applied to a `cloth_print` slot.

---

## 1. Characters

### 1.1 Base bodies, rig and face (Tier A)

The player avatar is one of **10 presets** (5 feminine, 5 masculine presentation, various skin tones). Witnesses and passers-by reuse the same system.

| # | Asset | Notes |
| --- | --- | --- |
| 1 | Adult body, masculine presentation, rigged | Realistic adult proportions (about 7.5 heads tall), standing height 1.75 m |
| 2 | Adult body, feminine presentation, rigged | Same skeleton |
| 3 | Elder body variants (masc/fem) | Slightly bent posture, optional (B) |
| 4 | Child / teen body (B) | For market crowds and festival |
| 5 | Body-shape variants (B) | Slim / average / broad (plus heavy) as blend shapes or 2-3 swap meshes |
| 6 | Hands | Rigged fingers; poses: relaxed, point, hold-paper, grip (carry), open palm |
| 7 | Head/face | Neutral face with **blendshapes**: blink, jaw-open (speech), smile, frown, brow up/down, eyes look L/R/up/down, plus visemes (A, E, I, O, U, M/B/P, F/V, rest) for talking. The game plays a voiced dialogue |
| 8 | Eyes, teeth, tongue | Separate meshes so skin tone tint does not affect them |
| 9 | Feet/shoes base | Barefoot base for flip-flops, sandals |

Skeleton: ~55 bones body + hands (finger bones) + face/jaw/eyes. Include IK-friendly leg and arm chains and a root bone for locomotion.

### 1.2 Hair (Tier A) - separate meshes that attach to the head bone, tinted via `hair`

The 10 existing styles (all must be done, each in a form that fits both bodies):

1. Close crop 2. Low cut 3. Fade 4. Short coils 5. Short waves 6. Short locs 7. Bob 8. Shoulder-length twists 9. Braided bun 10. Head wrap (cloth, tinted primary with accent band)

Additional hair for variety (B): afro, cornrows/braids long, box braids, bald, balding elder, grey elder, beard/stubble/moustache set (5 styles), eyebrows.

### 1.3 Clothing (Tier A/B) - modular, skinned to the shared skeleton, tinted by slot

| Group | Items |
| --- | --- |
| Investigator uniform (A) | Jacket with collar, front panel, badge, belt; trousers; boots. Masculine and feminine cuts. Must support the 5 colour slots |
| Everyday (A) | T-shirt, shirt, trousers, shorts, skirt, dress, sandals/flip-flops, sneakers, formal shoes |
| Nigerian traditional (A) | Wrapper (iro) and blouse (buba), gele (several tie styles), agbada, kaftan/senator, fila/cap, Hausa gown (babanriga) with fula/kufi, wrapper skirt (ankle length) |
| Occupation (B) | Hi-vis vest and hard hat, lab coat, scrubs, chef apron and hat, police uniform with cap, soldier-style guard uniform, pilot jacket and cap, customs uniform, sailor/dockworker overalls, miner/quarry overalls, ranger uniform and hat, judge robe, cassock/priest robe, imam robe and cap, choir robe, hotel uniform, waiter apron, bouncer jacket, performer/dancer costume, festival costume, carnival costume, drummer outfit, fisherman oilskin, farmer clothes, mechanic overalls |
| Accessories (B) | Glasses, sunglasses, mask, watch, necklace/beads, earrings, lanyard/ID badge, headphones, hijab/headscarf, turban |
| Judge props (A) | Paper on a stick (vote paper, two faces) for the 5 judges |

### 1.4 Carried props (Tier A/B)

Baton, sack, basket (head-carry and hand), hoe, briefcase, handbag, shoulder sack, notepad/clipboard, phone, tray, bucket, jerrycan, fishing net, rope, megaphone, luggage (small bag, suitcase, backpack), broom, camera, microphone, mug/cup, umbrella, drumsticks, talking drum, flag, bunch of keys.

### 1.5 Animation clips on the shared skeleton (Tier A unless noted)

Every clip is root-in-place unless stated, loopable where marked. Game already uses: gait phase, stride amount, a 0-1 "sit" blend, and heading.

| Group | Clips |
| --- | --- |
| Locomotion | Idle (2-3 variations, loop), walk (loop), brisk walk, run (loop), jog, sneak/pace, turn-in-place L/R, start/stop steps |
| Seated | Stand-to-sit, sit-idle, sit-to-stand, **drive** (hands on wheel, loop), sit in bus seat |
| Social/talking | Talk (3 gesture variants, loop), listen/nod, shake head, shrug, point, beckon, wave, hand-over paper, receive paper, look at note |
| Reactions | Surprised, worried/nervous, relieved, angry, laugh |
| Interaction | Open door, hitch-hike (thumb out), get in car, get out of car, step onto bus, enter/exit building |
| Judge panel | Sit-idle (judge), raise paper (up), hold, lower, stand to receive judgement, bow head (accept), stand before judges |
| Occupational loops (B) | Hoeing/digging, carrying sack, loading/unloading, sorting goods, weaving, dyeing (stir), carving, hammering, welding, cooking/stirring, serving a tray, writing at a desk, typing, stamping a document, handing a ticket, mopping/sweeping, fishing/hauling net, rowing/poling a boat, operating machinery, checking luggage, security pat-down, calling a bus (agbero), drumming, dancing (3-4 styles), praying (kneel/prostrate) and worship (hands raised), singing, preaching, reading a book, microscope/inspection, bartending, photographing |
| Chase | Run with carried item, stumble, hands up |
| Crowd (B) | Simple stand/chat/walk clips for background figures (can be reduced bones) |

Provide root-motion-free versions plus a speed range for the walk cycle (about 0.9-2.4 m/s) so footsteps do not slide.

---

## 2. Vehicles (Tier A unless noted)

All wheels separate nodes named `wheel_*` (spin axis X, centred), steering wheel a separate node, doors/boot as nodes where stated, interior modelled where a person sits.

| # | Vehicle | Notes |
| --- | --- | --- |
| 1 | **Player's car** (open-top runabout) | Hero asset, interior and driver seat for the sit pose, doors, tailgate, headlights, brake lights, dashboard, glossy paint (tint slot for body colour) |
| 2 | **Danfo** (Lagos yellow/black minibus) | Opening door (node `door`), passenger seats, interior, roof rack, painted slogans (use fictional text), conductor hanging on |
| 3 | Intercity bus / coach | Used in hitch-ride journeys |
| 4 | Generic saloon cars (3-4 body styles) | Tint slot; traffic and parked cars |
| 5 | SUV/jeep (ranger jeep with roof rack and spare wheel) | Conservation office |
| 6 | Pickup truck / hilux | Farms, police |
| 7 | Livestock truck with ramp | Cattle market |
| 8 | Haul truck (mining) and excavator/digger | Mining site |
| 9 | Fuel tanker (articulated) | Refinery, factory gate, airport |
| 10 | Container lorry / flatbed | Seaport, factory |
| 11 | Delivery van / box truck | Factory, markets |
| 12 | Keke (tricycle) and okada (motorbike) with rider seat | Street life, motor park |
| 13 | Bicycle and handcart / wheelbarrow | Markets, railway porters |
| 14 | Police car and police van | Police station |
| 15 | Ambulance | Hospital |
| 16 | Train: locomotive, passenger carriages (2-3 liveries) | Railway station; coupling points, windows, doors |
| 17 | Passenger aeroplane (regional jet) | Journey (fly) and airport apron; landing gear that retracts, rotating props/engines optional, tinted livery slot |
| 18 | Airport ground vehicles | Baggage tractor + carts, stairs, fuel truck |
| 19 | Boats (B): fishing canoe (wooden, long), motor launch (passenger with canopy), dinghy, ferry/barge, cargo ship (hull, bridge, funnel, deck cargo), tugboat | Water-edge venues, waterfront, seaport |
| 20 | Horse (B) with tack, and a cow (several patterns), goat, sheep, chicken, dog, cat | Palace, cattle market, farm, villages. Include simple walk/idle/graze clips |
| 21 | Hot-air/Wheeled props: wheelbarrow, trolley, forklift (C) | Warehouse, port |

---

## 3. Venue environments

The witness scenes happen at **35 venues**: the market plus 16 open-air venues plus 18 building venues. Each is composed from kit modules;
the artist should deliver **a shared kit plus per-venue hero pieces**. Per-venue lists are the *minimum* set of recognisable pieces.
Each venue also needs: ground/floor material set, a back-wall/backdrop piece that is plain behind the witness, lights (emissive night variants), and signage planes.

Night variants: every lit element should have an emissive map or emissive material (windows, lamps, neon, grills, glowing screens).

### 3.1 Market (the original venue, Tier A)
Stalls with awning (several fabrics/colours) and wooden table, shelves, produce piles (tomato, pepper, yam, onion, plantain, oranges), baskets, sacks, cloth bolts, utensil/pot stacks, scales, umbrellas, hawker trays, bargain boards, handcarts, back wall with painted shop fronts, generator, sign boards.

### 3.2 Open-air venues (16)

**Market variants (3)**
- **Cattle market:** animal pens (rail fences, gates), feed shed with dark wall, livestock truck + ramp, cow (several hides), goats, hay bales, feed sacks, water trough, ropes/posts, dust.
- **Craft market:** stalls with awnings, **loom** (weaver), dye vats (blue indigo, round) with cloth drying lines, carved masks and statues, bronze casting forge, leather goods, adobe wall, woven mats, pottery.
- **Festival ground:** stage platform with roof on posts, banner, speaker stacks, drum set and talking drums, lighting rigs/flood lights, bunting (animated), food stalls with grill (glow), shade pavilion, crowd barriers, dance-floor area.

**Transport hubs (3)**
- **Motor park:** rows of parked minibuses/buses, patched awnings, benches, luggage, ticket kiosk, destination board (fictional destinations), generator, tyre stacks, oil drums, mechanic corner, vendors, agbero.
- **Railway station:** station building with clock and name, platform with yellow edge line, canopy/shelter, benches, ticket window, tracks (rails, sleepers, ballast), train (see vehicles), signals, handcarts, porters' bags, footbridge (B).
- **Airport:** terminal facade with lit glass band, check-in canopy with desks, trolleys, conveyor/baggage, control tower, apron markings, parked aeroplane, fuel tanker, baggage train, stairs, security gate, jet bridge (B).

**Water edge (5)**
- **Beach:** sand, lifeguard tower with flag, fishing boats drawn up on the sand, food stands, drying net rack, umbrellas, palm trees, waves/foam strips, driftwood.
- **Fishing jetty:** wooden landing on pilings, boats alongside, crates of fish, heaped nets, ticket hut, mooring posts, ropes.
- **Jetty (passenger):** pier with steps, covered passenger launch, small boat, ticket table + umbrella, route board, luggage.
- **Waterfront:** boats on mud and afloat, fish sellers' baskets, food stall, warehouse with name over door, mooring bollards, seawall.
- **Seaport:** cargo ship at the quay, portal/gantry crane with swinging container, container stacks (several colours), customs shed, lorry, bollards, lamp masts, pallets, forklift.

**Work and land (5)**
- **Farm:** crop rows (cassava, maize, yam mounds, tomato), sorting shed with tin roof, water tank on stand, farmhouse with lit window, goat pen with lantern, scarecrow, wheelbarrow, tools.
- **Mining site:** rock heaps, pit edge, conveyor, digger, haul truck, crusher, safety signs, portable cabin, barriers, drilling rig (C).
- **Refinery:** storage tanks (large, white), pipe rack, flare stack (animated flame), cooling towers, control cabin, tanker bay, gantry stairs, safety signage, floodlights.
- **Factory gate:** long factory wall, sawtooth roof, loading doors, chimney (animated smoke), gate barrier + guard house, tankers queue, fencing, name sign.
- **Conservation office:** cream building with green roof and veranda, notice boards, field jeep, radio mast, trees, wildlife statue/map, fence.

Cross-venue kit for open-air (Tier A): fences, gates, crates (wood, plastic), barrels/drums, pallets, sacks, tyres, tarpaulin, plastic chairs and tables, benches, lamp posts, sign boards, generators, tents/awnings, umbrella, bollards, cones, power poles and wires, standpipes/water tanks, rubbish bins.

### 3.3 Building venues (18) - exterior front (the camera shoots the front + forecourt) and the visible interior if doors open

Each needs: facade (walls, windows, door, steps, roof), signage with venue name, forecourt furniture, plain wall behind the witness, entrance to her left, lit windows at night.

| Group | Venue | Key pieces |
| --- | --- | --- |
| Worship | **Church** | Facade with cross and steeple/bell tower, double doors, stained-glass windows, steps, notice board, pews (interior), pulpit, altar, choir stalls, candles |
| | **Mosque** | Dome(s), minaret(s) with loudspeakers and crescent, arched doorway, ablution area with taps and stools, shoe racks, prayer mats, mihrab, minbar |
| | **Sacred grove** | Dense trees with large trunks, shrine, altar, carved posts, offerings, white cloth, calabashes, clay pots, path stones, thatch shelter |
| Civic | **Police station** | Facade, flagpole, barred windows, desk, counter, holding cell bars, notice boards, police vehicles, barrier, radio mast |
| | **Hospital** | Facade with red cross sign, ambulance bay, reception desk, wheelchair, stretcher, beds, curtains, medical cabinet, drip stand, waiting chairs, records shelves |
| | **Community hall** | Hall facade, hall interior with chairs and stage, notice board, dance floor, drum, benches |
| | **Traditional council** | Council hall with verandah, chiefs' seats/thrones (carved), stools, staffs, ceremonial cloths, court table, records books |
| | **Emir's palace** | Mud-brick/adobe palace gate with arch and crenellations, guards post, horse stable, decorated door, courtyard, horse with tack, fan/umbrella props |
| | **Palace** | Royal palace front, throne, columns, guard boxes, drums, ceremonial seats and flags, courtyard |
| Culture/learning/media | **Museum** | Columned facade, display cases, plinths, artefacts (bronze head, masks, pottery, textiles), information panels, rope barriers, ticket desk |
| | **Library** | Bookshelves (full), reading tables, lamps, desk, catalogue cabinet, ladder, books (several covers), globe |
| | **University** | Lecture-hall facade, lecture seats, blackboard/whiteboard, lectern, noticeboards, benches, quad with trees |
| | **Monument** | Large monument (generic fictional landmark), plinth, plaques, flagpoles, paved plaza, fence, benches, photographer's tripod |
| | **Radio station** | Facade with mast, **studio interior**: mixing desk, microphones on arms, headphones, glass booth, "on air" sign, antenna, speakers, reel/cassette racks |
| | **Carnival workshop** | Workshop with costumes on mannequins and racks, floats (partial), welding area, drums, sewing tables, feather headdresses, paint pots |
| Hospitality | **Hotel** | Facade with lobby doors, reception desk, luggage trolley, bell, lobby seating, signage, canopy, potted plants, room keys board |
| | **Restaurant** | Facade, tables and chairs, menu board, serving counter, kitchen pass, pots/pans, cooker, plates, cutlery |
| | **Nightclub** | Facade with neon sign, velvet rope and barrier, bar counter, stools, DJ booth, speakers, disco/spot lights, dance-floor, bottles/glasses, glowing neon |

Shared building kit (Tier A): wall/window/door/column modules in several styles (modern concrete, colonial, adobe/mud-brick, tin-roof bungalow, mosque/church styles), roof types (flat, gabled, tin, tile, thatch, dome, sawtooth), steps and ramps, balustrades, awnings, gutters, flagpoles and flags (animated cloth), lamp posts, kerb furniture (bins, bollards, benches, water pot, signboard, bicycle), trees (neem, mango, palm, baobab, flame tree, shrubs), hedge, planters, gate/fences, paving, grass/dirt/sand ground textures.

---

## 4. Chase and journey worlds

### 4.1 Chase street (3 biomes, loops past the runners) - Tier A/B
Currently the scene is the same ring for **Lagos**, **Anambra (Onitsha-style market)** and **Kano**.

- **Lagos:** Atlantic seafront promenade with sea wall, palm trees, high-rise towers (3-4 styles), **long bridge** (cable-stayed, Lekki-style but fictional), danfo buses (above), fishing boats, lighthouse, billboards, commuters, street lamps, traffic signs, okada, hawkers.
- **Anambra:** Market streets (shopfronts with painted signs, stalls, stacked goods), shop awnings, **Niger-Bridge-style steel arch bridge** (distant), river, trees, tricycles, traders carrying goods on head.
- **Kano:** **Groundnut pyramids** (sacks stacked into pyramids), mud-brick architecture with decorative patterns, **Dala Hill** (distant), baobab trees, farmland, camel (B), donkey cart (B), farmers, minarets.
- **Common:** road with markings, kerbs, pavements, street furniture (lamp posts, poles with cables, bins, benches, bus stop shelters, road signs), 3 city signboards (large gateway/arch gantries), runners' props, trees and bushes, shrubs, rocks.
- **Textures:** wax-print fabrics (several), sea water (tileable, animated), road asphalt with wear, pavement tiles, brick/mud/concrete/stucco walls, tin roof, tile roof, painted shopfront boards, graffiti (fictional), grass/dirt/sand.

### 4.2 Journey (side-scrolling travel scene) - modes: drive, hitch a ride, fly - Tier A/B
Prop kinds the code uses: tree, palm, pine, baobab, cactus, rock, bush, reed, crop, hut, stall, building, boat, pole, water, hill, cloud, garage, bus stop, parked bus, billboard, terminal, control tower, hangar.

- Landscape sets (savanna, forest, coast, desert/Sahel, farmland, urban edge), each with a few variants of each prop kind above.
- Distant hills (several silhouettes), clouds (volumetric billboards), water/river/sea, road with lane markings and shoulders, poles/wires.
- Garage building (departure), bus stop shelter, parked bus, airport terminal, control tower, hangar, aeroplane (see vehicles), runway lights, billboards (fictional ads).
- Road signs, milestones, tolls (C), checkpoint (C), market stalls at the roadside, huts, trucks passing, goats crossing (C).

---

## 5. Interiors (office, garage, archive, panel) - Tier A

**Case office (the player's desk room)** - the main hub screen
Desk (with drawers), CRT monitor on stand, keyboard and keys, mouse and mat, desk lamp, mug, papers and folders, filing cabinet, wall board with frame (corkboard), window with frame and sill, wainscoting and wall panels, plant in pot (leafy), office chair with casters, door, wall clock, phone, shelves, coat stand, floor covering, ceiling light, curtains/blinds, posters, plus **animated** monitor screen (render-to-texture in code), steam over mug (C).

**Garage (after briefing)** - The player enters, waits among parked cars, then drives off or hitches
Garage shell with roller shutter (animated), door the player walks through, bay lines, workbench, shelves with cans, drums with bands, tyre stacks, tubes and brackets, tool wall, oil drums, lifts/jack (C), parked cars (see vehicles), floor decals, lighting (strip lights), roadside strip outside with kerb.

**Archive room** - shelves of case files
Tall shelving, archive boxes with labels (many variants), filing cabinets with drawers (opening), ladder (rolling), pendant lamp, table with lamp, folders and papers, cord/cables, planks, stacked boxes, floor and wall textures, dust particles (code).

**Disciplinary panel hall**
Court/panel hall: back wall, side walls, wainscoting, five judges' desks/bench (with nameplates), dais (raised), the player's standing mark, front wall, floor, ceiling, flags, coat of arms (fictional), clock, windows, five judge chairs, microphone, gavel, water jug and glasses, voting paper stand.

**Case folder, notebook, evidence props (B)**: folder, notebook, dossier sheets, photographs, evidence bags, magnifier, passport/ID, map, tickets, receipts, coins/banknotes (fictional), keys, USB, phone.

---

## 6. VFX, textures, audio-adjacent assets

| Group | Items |
| --- | --- |
| Textures (Tier A) | Tileable PBR sets: asphalt, concrete, brick, adobe/mud, plaster, tin roof, clay tile, wood planks, metal, grass, dirt, sand, gravel, wet sand, water normal map, tiles (floor, hospital, restaurant), carpet, fabric weave |
| Fabrics (A) | 10-15 Ankara / wax-print / adire / aso-oke tileable patterns (original designs) for clothing, awnings, stalls and bunting |
| Signage (B) | Font-based sign plates are produced in code; deliver blank sign meshes of different shapes and a hand-painted-lettering font or texture set |
| Sky (B) | Skydomes: dawn, day, dusk, night (HDR or 2k LDR), cloud textures, stars, moon; lighting/environment maps per biome |
| VFX (B/C) | Flame (flare stack, grill, candle), smoke/steam (chimney, kitchen), dust, spray/foam (waves), rain (C), exhaust, sparks (welding), headlight cones, floodlight beams, light halo sprites, flag/cloth sway (vertex animation or skinned), ripples |
| Decals (C) | Road markings, painted ads (fictional), stains, chalk marks |
| Props animation (B) | Crane trolley, conveyor belt, windsock, flags, rotating radar, ceiling fan, swinging signs, boats bobbing, train arriving, plane taxi/take-off/landing, door open/close sets, roller shutter, barrier arm, car doors |

---

## 7. Deliverable checklist for quoting

| Category | Approx count |
| --- | --- |
| Rigged bodies (masc/fem + elder/child/builds) | 4-8 |
| Heads/face rigs with blendshapes | 2-4 (masc/fem) |
| Hair styles (+ facial hair) | 10 required, ~10 extra |
| Clothing pieces | ~60-80 |
| Carried props and accessories | ~35 |
| Animation clips | ~80-120 |
| Vehicles | ~35-45 (incl. variants) |
| Animals | ~8 (with clips) |
| Venue kits | 35 venues (shared kit + hero pieces) |
| Shared environment props (open-air, buildings, streets) | ~250-400 |
| Chase/journey scenery pieces | ~80-120 |
| Interior sets (office, garage, archive, panel hall) | 4 sets, ~100 props |
| Texture sets, fabrics, skyboxes | ~40 texture sets, 12 fabrics, 4 skies |
| VFX sprites/meshes | ~15 |

### Suggested delivery order if staged (still one contract)
1. **Milestone 1 (Tier A core):** skeleton, 2 bodies + faces, 10 hair styles, investigator uniform + everyday clothes, core animation clips, player's car and danfo, office + garage + panel interiors.
2. **Milestone 2:** transport/water/work venues kit and vehicles, plus witness NPC variety (clothing, occupations, clips).
3. **Milestone 3:** building venues (18) kit, culture/hospitality interiors, chase biomes and journey sets.
4. **Milestone 4 (B/C):** polish: elders/children, crowd LODs, animals, VFX, extra variants, skies.

## 8. What the code side will do (so the artist does not have to)
Load GLBs lazily with `@babylonjs/loaders`, cache and instance them, recolour via the named material slots, attach hair/clothing to the shared skeleton,
fall back to the existing procedural models if a GLB fails to load, and keep the 2D renderer unchanged.
The artist only needs to respect the naming sheet, material slots and skeleton described above.
