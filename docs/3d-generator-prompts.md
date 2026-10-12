# 3D asset prompts: what to type, what to name the file, where to save it

This is a step-by-step shopping list for making every 3D model in the game with an AI 3D tool (Meshy, Tripo, or similar),
**with no Blender and no artist**. Every item has:

- a **number** (so you can tick it off),
- the **file name** to save it as,
- the **prompt** to paste into the tool.

The folder for each group is given at the top of that group. All folders sit under:

```
web/public/assets/3d/
```

(Create the folders as you go. Anything in `web/public` is served by the website as a plain file, so no code is needed to "pack" it.
The game will download each file only when a scene needs it.)

---

**Progress:** what is already made and shrunk is tracked in [3d-asset-progress.md](./3d-asset-progress.md). After saving new files, check them on the test page and run `pnpm assets:optimize` in `web/`.

---

## 0. Words you will see (plain English)

| Word | What it means |
| --- | --- |
| **GLB** | The file type for a 3D model. It is one file that holds the shape, the colours and (for characters) the movement. Always export as GLB. |
| **Prompt** | The description you type into the tool. |
| **Text to 3D** | You type a description and the tool makes a model. This is what this document uses. |
| **Image to 3D** | You give the tool a picture and it makes a model from it. More reliable for hard things, but optional. |
| **Polygon / triangle count** | How detailed (and how heavy) a model is. Too many makes the game slow on phones. Every tool has a setting for it (often called "Low poly", "Quality" or "Polycount"). I give a **Detail** level for each group: see section 1. |
| **Remesh / simplify** | The tool's button that makes a model lighter. You only need it to apply the "Detail" level. |
| **Rig / auto-rig** | Adding a hidden skeleton so a character can move. Both tools have a one-click "Rig" or "Auto-rig" button. |
| **Animate** | Choosing a movement (walk, idle) from the tool's list and applying it to a rigged character. |
| **A-pose** | Standing with arms slightly away from the body. It helps the tool's rig work properly. |
| **Mixamo, retexture** | You don't need them. Ignore them. |

---

## 1. Rules that apply to everything

1. **Save as `.glb`**, always. If the tool asks, choose "GLB" and keep textures/colours included.
2. **File names: all lowercase, words joined with underscores, exactly as written in the tables.** The game finds each model by its file name.
   Do not add spaces, capital letters or "(1)".
3. **Don't worry about the size or direction of the model.** I will set the real size and which way it faces in the code, using a list I'll build from your files.
4. **Every prompt ends with a short style line** that makes all models look like the same game. It is already written into each prompt, so just paste the whole prompt as it is.
5. **One object per prompt.** If the tool gives four options, pick the one that looks best (cleanest shape, no strange extra bits) and download that.
6. **No text on models.** AI tools cannot spell. Signs, boards and banners are made blank on purpose; the game paints the names on them.
7. **No real brands or logos.** If a model comes out with a recognisable logo or lettering you can read, regenerate it.
8. **Detail level** (use the tool's polycount/quality setting):

| Level | Use for | Setting |
| --- | --- | --- |
| **Light** | small props (a crate, a lamp) | about 1,000 triangles ("low poly" / lowest) |
| **Medium** | furniture, carts, animals, signs, big props | about 3,000-5,000 |
| **Heavy** | vehicles, buildings, hero scenery | about 8,000-12,000 |
| **Character** | every person | about 8,000-10,000 |

9. **Keep a record.** Tick the checkbox for each file and keep your favourite prompt wording in a note. If a result is bad, regenerate or tweak the prompt (see section 9).
10. **Quick check before saving:** turn the model around in the tool's preview. If it has missing chunks, holes, extra floating bits or melted shapes, regenerate.

---

## 2. How to make one normal item (props, vehicles, buildings, animals)

1. Open the tool and choose **Text to 3D**.
2. Paste the prompt.
3. Generate. Pick the best of the results.
4. Apply the detail level for that group (see rule 8).
5. Make sure **textures/colours are on** (some tools give a plain grey draft first; use their "Texture" or "Refine" step to add the colours).
6. Download as **GLB**.
7. Rename the file to the name in the table and put it in the folder shown at the top of that group.

## 3. How to make a character (people)

Do this for every item in section 4. Characters take more steps.

1. **Text to 3D** with the prompt. All character prompts say "A-pose" so the tool can move them. Choose a character-friendly mode if the tool has one (often called "Humanoid" or "Character").
2. Pick the best result. Check the hands (fingers fused together is normal) and the face (no melted features). Regenerate if bad.
3. Click **Rig** (or **Auto-rig**). Choose **humanoid / biped**.
4. Click **Animate** and, in the export window, tick the movements you need. **Export everything as ONE file** (not one file per movement) and keep **Export Skeleton** and **Animation stay in place** switched on:

| Movement | Needed for |
| --- | --- |
| Walk | all characters |
| Run | player avatars and runners |
| Sit | player avatars only (and drivers) |

   Leave out any movement the tool does not offer. Idle needs no clip, because the standing pose is the starting pose. I cover talking and anything missing in code.
   Name the file exactly as in the tables (no `_all`, no `_walk`).
5. Save everything in the folder shown for that group.

---

## 4. Characters  → `web/public/assets/3d/characters/`

### 4.1 The ten player avatars  → folder `characters/avatars/`

These are the player's choices. Their looks match the game's avatar picker (name, hair, skin tone and uniform colour).
Each prompt makes them in the game's investigator uniform (a smart jacket with a lighter front panel, a belt, and boots).

Character style line used in every prompt below: *stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background.*

| # | Save as (one file, with walk, run and sit inside) | Prompt |
| --- | --- | --- |
| 4.1.1 | `avatar_01_emerald_braids.glb` | Young Nigerian woman, deep dark skin, cornrow braids gathered into a high braided bun, black hair, wearing an emerald green investigator jacket with a cream front panel and a gold belt, dark trousers and boots, 1.65 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.2 | `avatar_02_midnight_low_cut.glb` | Young Nigerian man, very dark skin, short low-cut black hair, wearing a navy blue investigator jacket with a pale grey front panel and a gold belt, dark trousers and boots, 1.78 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.3 | `avatar_03_burgundy_wrap.glb` | Nigerian woman, medium-deep brown skin, a burgundy head wrap tied on top with a gold band, wearing a burgundy investigator jacket with a cream front panel and a gold belt, dark trousers and boots, 1.65 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.4 | `avatar_04_forest_coils.glb` | Nigerian man, deep brown skin, short tight coily black hair, wearing a forest green investigator jacket with a beige front panel and a bronze belt, dark trousers and boots, 1.78 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.5 | `avatar_05_cobalt_bob.glb` | Nigerian woman, medium brown skin, chin-length straight black bob haircut, wearing a cobalt blue investigator jacket with a cream front panel and a golden-yellow belt, dark trousers and boots, 1.65 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.6 | `avatar_06_copper_fade.glb` | Nigerian man, medium-light brown skin, short fade haircut with flat top, black hair, wearing a copper-orange investigator jacket with a cream front panel and a navy belt, dark trousers and boots, 1.78 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.7 | `avatar_07_teal_twists.glb` | Nigerian woman, rich deep brown skin, shoulder-length twists hairstyle, black hair, wearing a teal investigator jacket with a pale green-white front panel and a gold belt, dark trousers and boots, 1.65 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.8 | `avatar_08_gold_crop.glb` | Nigerian man, light brown skin, close-cropped dark brown hair, wearing a mustard-gold investigator jacket with a cream front panel and a navy belt, dark trousers and boots, 1.78 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.9 | `avatar_09_plum_locs.glb` | Nigerian woman, medium-deep brown skin, short locs hairstyle, black hair, wearing a plum purple investigator jacket with a pale pink-white front panel and a gold belt, dark trousers and boots, 1.65 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |
| 4.1.10 | `avatar_10_slate_waves.glb` | Nigerian man, medium brown skin, short wavy black hair, wearing a slate grey-blue investigator jacket with a pale grey front panel and a bronze belt, dark trousers and boots, 1.78 m tall. Stylised game character, realistic adult proportions, neutral calm expression, mouth closed, A-pose, plain background. |

### 4.2 Witnesses (people the player questions)  → folder `characters/witnesses/`

The game has about 90 different witness looks. You do not need one model per look. Make these **16** and the game will reuse and
colour-vary them. Same steps as section 3, but only Walk is needed, still in one file. (Tripo has no talking animation; the game will fake talking with small head and arm movements.)

| # | Save as | Prompt |
| --- | --- | --- |
| 4.2.1 | `witness_woman_trader.glb` | Middle-aged Nigerian market woman, medium brown skin, colourful gele head tie, loose Ankara blouse and wrapper skirt to the ankle, sandals, friendly expression. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.2 | `witness_woman_young.glb` | Young Nigerian woman, brown skin, braided hair, simple blouse and knee-length skirt, sneakers. Stylised game character, realistic adult proportions, neutral expression, mouth closed, A-pose, plain background. |
| 4.2.3 | `witness_woman_professional.glb` | Nigerian woman in her thirties, smart blouse and trousers, hair in a neat bun, a lanyard ID badge around the neck. Stylised game character, realistic adult proportions, neutral expression, mouth closed, A-pose, plain background. |
| 4.2.4 | `witness_woman_elder.glb` | Elderly Nigerian woman, slightly stooped, grey hair under a head wrap, long wrapper and buba blouse, walking cloth shawl. Stylised game character, mouth closed, A-pose, plain background. |
| 4.2.5 | `witness_woman_uniform.glb` | Nigerian woman in a plain work uniform (shirt, trousers, cap), working-class, practical boots. Stylised game character, realistic adult proportions, neutral expression, mouth closed, A-pose, plain background. |
| 4.2.6 | `witness_man_trader.glb` | Nigerian market man, dark brown skin, short hair, short-sleeved shirt and trousers, sandals, rolled-up sleeves. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.7 | `witness_man_young.glb` | Young Nigerian man in his twenties, short fade haircut, t-shirt and jeans, sneakers. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.8 | `witness_man_professional.glb` | Nigerian man in a smart shirt, tie and trousers, formal shoes, short hair. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.9 | `witness_man_agbada.glb` | Nigerian man in an elegant flowing agbada robe with embroidery and a matching fila cap. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.10 | `witness_man_northern.glb` | Hausa man in a long flowing embroidered babanriga gown and a fula cap, neat beard, leather sandals. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.11 | `witness_man_elder.glb` | Elderly Nigerian man, grey hair and short grey beard, traditional cap, kaftan tunic and trousers, walking stick. Stylised game character, slightly stooped, mouth closed, A-pose, plain background. |
| 4.2.12 | `witness_man_worker.glb` | Nigerian worker in a hi-vis vest, hard hat, overalls and work boots. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.13 | `witness_man_security.glb` | Nigerian security guard in a plain dark uniform with cap, belt and boots. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.14 | `witness_man_farmer.glb` | Nigerian farmer in a loose shirt, trousers rolled up, straw hat and rubber boots. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.15 | `witness_man_cleric.glb` | Nigerian man in a dark clerical or religious robe with a collar, kind face, short hair. Stylised game character, realistic adult proportions, mouth closed, A-pose, plain background. |
| 4.2.16 | `witness_child.glb` | Nigerian child, about 10 years old, school uniform shirt and shorts, sandals. Stylised game character, mouth closed, A-pose, plain background. |

### 4.3 Judges (five of them, in the disciplinary panel)  → folder `characters/judges/`

Only the main file is needed, but they should be **sitting at a desk**. Prompt for sitting; skip the rig steps if the tool has trouble (they stay seated). Slightly different faces so they are not copies.

| # | Save as | Prompt |
| --- | --- | --- |
| 4.3.1 | `judge_1.glb` | Nigerian man judge, grey hair, dark judicial robe with white collar bands, seated upright, hands on a desk, stern face. Stylised game character, mouth closed, plain background. |
| 4.3.2 | `judge_2.glb` | Nigerian woman judge, short grey hair, dark judicial robe with white collar bands, seated upright, hands on a desk, serious face. Stylised game character, mouth closed, plain background. |
| 4.3.3 | `judge_3.glb` | Nigerian man judge, bald, glasses, dark judicial robe with white collar bands, seated upright, hands on a desk, calm face. Stylised game character, mouth closed, plain background. |
| 4.3.4 | `judge_4.glb` | Nigerian woman judge, braided hair pinned up, dark judicial robe with white collar bands, seated upright, hands on a desk, calm face. Stylised game character, mouth closed, plain background. |
| 4.3.5 | `judge_5.glb` | Nigerian man judge, white beard and short white hair, dark judicial robe with white collar bands, seated upright, hands on a desk, wise face. Stylised game character, mouth closed, plain background. |

### 4.4 Background people (walking about in the chase and markets)  → folder `characters/crowd/`

One file with Walk only. These can be a bit lower detail (medium).

| # | Save as | Prompt |
| --- | --- | --- |
| 4.4.1 | `crowd_commuter_man.glb` | Nigerian man commuter in a shirt and trousers carrying a small bag, walking. Stylised game character, A-pose, mouth closed, plain background. |
| 4.4.2 | `crowd_commuter_woman.glb` | Nigerian woman commuter in a smart dress and sandals, handbag on shoulder. Stylised game character, A-pose, mouth closed, plain background. |
| 4.4.3 | `crowd_trader_man.glb` | Nigerian male trader in a short-sleeved shirt and trousers, carrying a big bag of goods on the shoulder. Stylised game character, A-pose, plain background. |
| 4.4.4 | `crowd_trader_woman.glb` | Nigerian female trader in Ankara wrapper and blouse, a bowl of goods balanced on the head. Stylised game character, A-pose, plain background. |
| 4.4.5 | `crowd_farmer.glb` | Hausa farmer in a long gown and fula cap, carrying a hoe. Stylised game character, A-pose, plain background. |
| 4.4.6 | `crowd_student.glb` | Nigerian student in a uniform with a backpack. Stylised game character, A-pose, plain background. |
| 4.4.7 | `crowd_dancer_festival.glb` | Nigerian festival dancer in a bright costume with beads, mid-pose with arms slightly raised. Stylised game character, plain background. |
| 4.4.8 | `crowd_drummer.glb` | Nigerian drummer holding a talking drum under the arm, colourful kaftan. Stylised game character, A-pose, plain background. |
| 4.4.9 | `crowd_chef.glb` | Nigerian chef in white chef jacket and hat. Stylised game character, A-pose, plain background. |
| 4.4.10 | `crowd_doctor.glb` | Nigerian doctor in a white coat with a stethoscope. Stylised game character, A-pose, plain background. |
| 4.4.11 | `crowd_nurse.glb` | Nigerian nurse in scrubs and cap. Stylised game character, A-pose, plain background. |
| 4.4.12 | `crowd_police.glb` | Nigerian police officer in a plain dark uniform and peaked cap (no badges with text). Stylised game character, A-pose, plain background. |
| 4.4.13 | `crowd_pilot.glb` | Pilot in a dark jacket with epaulettes and a pilot cap. Stylised game character, A-pose, plain background. |
| 4.4.14 | `crowd_sailor_docker.glb` | Dock worker in orange overalls and hard hat. Stylised game character, A-pose, plain background. |
| 4.4.15 | `crowd_fisherman.glb` | Fisherman in an oilskin jacket and rubber boots, holding a net. Stylised game character, A-pose, plain background. |
| 4.4.16 | `crowd_miner.glb` | Miner in overalls with helmet and headlamp. Stylised game character, A-pose, plain background. |
| 4.4.17 | `crowd_ranger.glb` | Park ranger in a green uniform and wide-brimmed hat. Stylised game character, A-pose, plain background. |
| 4.4.18 | `crowd_waiter.glb` | Waiter in a white shirt, black trousers and apron, carrying a tray. Stylised game character, A-pose, plain background. |
| 4.4.19 | `crowd_receptionist.glb` | Hotel receptionist in a smart uniform with a neat scarf. Stylised game character, A-pose, plain background. |
| 4.4.20 | `crowd_imam.glb` | Imam in a white robe and turban, short beard. Stylised game character, A-pose, plain background. |
| 4.4.21 | `crowd_priest.glb` | Priest in a black cassock with a white collar. Stylised game character, A-pose, plain background. |
| 4.4.22 | `crowd_mechanic.glb` | Mechanic in oily blue overalls, a rag in the pocket. Stylised game character, A-pose, plain background. |
| 4.4.23 | `crowd_bouncer.glb` | Burly nightclub bouncer in a black jacket and trousers, arms folded. Stylised game character, plain background. |
| 4.4.24 | `crowd_chief.glb` | Traditional chief in rich embroidered robes with a beaded crown and a staff. Stylised game character, A-pose, plain background. |

---

## 5. Things people carry  → `web/public/assets/3d/props/held/`

Detail: Light. No rig needed. These are optional extras; the game can survive without them, so do them last.

| # | Save as | Prompt |
| --- | --- | --- |
| 5.1 | `held_baton.glb` | Short black police baton with a rubber grip. Stylised game asset, single object, plain background, no text. |
| 5.2 | `held_sack.glb` | Tied burlap sack, full, standing. Stylised game asset, single object, plain background, no text. |
| 5.3 | `held_basket.glb` | Large round woven basket for carrying on the head, empty. Stylised game asset, single object, plain background, no text. |
| 5.4 | `held_hoe.glb` | Wooden-handled farming hoe with a metal blade. Stylised game asset, single object, plain background, no text. |
| 5.5 | `held_briefcase.glb` | Brown leather briefcase with a handle. Stylised game asset, single object, plain background, no text. |
| 5.6 | `held_handbag.glb` | Woman's leather handbag with a shoulder strap. Stylised game asset, single object, plain background, no text. |
| 5.7 | `held_backpack.glb` | Canvas backpack. Stylised game asset, single object, plain background, no text. |
| 5.8 | `held_suitcase.glb` | Hard travel suitcase on wheels. Stylised game asset, single object, plain background, no text. |
| 5.9 | `held_clipboard.glb` | Clipboard holding blank paper. Stylised game asset, single object, plain background, no text. |
| 5.10 | `held_phone.glb` | Smartphone with a plain black screen. Stylised game asset, single object, plain background, no text. |
| 5.11 | `held_umbrella.glb` | Black open umbrella. Stylised game asset, single object, plain background, no text. |
| 5.12 | `held_jerrycan.glb` | Yellow plastic jerrycan. Stylised game asset, single object, plain background, no text. |
| 5.13 | `held_bucket.glb` | Metal bucket. Stylised game asset, single object, plain background, no text. |
| 5.14 | `held_tray.glb` | Round serving tray with glasses. Stylised game asset, single object, plain background, no text. |
| 5.15 | `held_talking_drum.glb` | Nigerian talking drum, hourglass shape with leather cords. Stylised game asset, single object, plain background, no text. |
| 5.16 | `held_vote_paper.glb` | Rectangular card on a wooden stick, flat, blank, left side green and right side red. Stylised game asset, single object, plain background, no text. |
| 5.17 | `held_fishing_net.glb` | Fishing net bundled in a heap. Stylised game asset, single object, plain background, no text. |
| 5.18 | `held_megaphone.glb` | Handheld megaphone. Stylised game asset, single object, plain background, no text. |
| 5.19 | `held_camera.glb` | Old-style camera with a lens. Stylised game asset, single object, plain background, no text. |
| 5.20 | `held_broom.glb` | Straw broom with a wooden handle. Stylised game asset, single object, plain background, no text. |

---

## 6. Vehicles  → `web/public/assets/3d/vehicles/`

Detail: Heavy. Vehicles are made as one solid piece; the game will make them roll along. The tool makes a full 3D model, so there is no view to choose.

| # | Save as | Prompt |
| --- | --- | --- |
| 6.1 | `car_player_runabout.glb` | Small open-top two-seat roadster car with round headlights, red body, black seats, a steering wheel, no roof. Stylised game asset, single vehicle, plain background, no text. |
| 6.2 | `bus_danfo.glb` | Lagos danfo minibus, yellow panel van with a black stripe, rounded 1970s-style van body, roof rack, sliding door, no readable text. Stylised game asset, single vehicle, plain background, no text. |
| 6.3 | `bus_coach.glb` | Intercity coach bus, white with a green stripe, large windows, luggage hold. Stylised game asset, single vehicle, plain background, no text. |
| 6.4 | `car_saloon_white.glb` | Plain four-door saloon car, white, generic design. Stylised game asset, single vehicle, plain background, no text. |
| 6.5 | `car_saloon_dark.glb` | Plain four-door saloon car, dark blue, generic design, slightly dusty. Stylised game asset, single vehicle, plain background, no text. |
| 6.6 | `car_hatchback.glb` | Small hatchback car, silver, generic design. Stylised game asset, single vehicle, plain background, no text. |
| 6.7 | `car_suv.glb` | Large SUV, black, generic design. Stylised game asset, single vehicle, plain background, no text. |
| 6.8 | `car_jeep_ranger.glb` | Safari field jeep, green, roof rack and spare wheel on the back, dusty. Stylised game asset, single vehicle, plain background, no text. |
| 6.9 | `truck_pickup.glb` | Double-cab pickup truck, white, dusty, open back. Stylised game asset, single vehicle, plain background, no text. |
| 6.10 | `truck_livestock.glb` | Livestock truck with slatted wooden sides and a loading ramp folded down at the back. Stylised game asset, single vehicle, plain background, no text. |
| 6.11 | `truck_mining_haul.glb` | Huge yellow mining dump truck with big tyres. Stylised game asset, single vehicle, plain background, no text. |
| 6.12 | `digger_excavator.glb` | Yellow excavator with tracks and an arm. Stylised game asset, single vehicle, plain background, no text. |
| 6.13 | `truck_tanker.glb` | Fuel tanker lorry, silver tank, no brand, no text. Stylised game asset, single vehicle, plain background. |
| 6.14 | `truck_container.glb` | Container lorry carrying a blue shipping container. Stylised game asset, single vehicle, plain background, no text. |
| 6.15 | `van_delivery.glb` | White box delivery van. Stylised game asset, single vehicle, plain background, no text. |
| 6.16 | `keke_tricycle.glb` | Yellow auto-rickshaw tricycle (keke) with a canopy. Stylised game asset, single vehicle, plain background, no text. |
| 6.17 | `okada_motorbike.glb` | Motorbike taxi (okada), red, with a passenger seat. Stylised game asset, single vehicle, plain background, no text. |
| 6.18 | `bicycle.glb` | Old bicycle with a rear rack. Stylised game asset, single object, plain background, no text. |
| 6.19 | `handcart.glb` | Wooden two-wheeled handcart. Stylised game asset, single object, plain background, no text. |
| 6.20 | `wheelbarrow.glb` | Metal wheelbarrow. Stylised game asset, single object, plain background, no text. |
| 6.21 | `car_police.glb` | Plain saloon police car, white with a dark stripe, a light bar on the roof, no text. Stylised game asset, single vehicle, plain background. |
| 6.22 | `van_police.glb` | White police van with a dark stripe and a light bar, no text. Stylised game asset, single vehicle, plain background. |
| 6.23 | `ambulance.glb` | White ambulance van with a red cross, light bar on the roof. Stylised game asset, single vehicle, plain background. |
| 6.24 | `train_locomotive.glb` | Diesel train locomotive, red and cream. Stylised game asset, single vehicle, plain background, no text. |
| 6.25 | `train_carriage.glb` | Passenger train carriage, red and cream, with windows and doors. Stylised game asset, single vehicle, plain background, no text. |
| 6.26 | `plane_airliner.glb` | Regional twin-engine passenger aeroplane, white with a blue tail, landing gear down, no airline logo. Stylised game asset, single vehicle, plain background, no text. |
| 6.27 | `airport_baggage_tractor.glb` | Airport baggage tractor pulling three baggage carts. Stylised game asset, single vehicle, plain background, no text. |
| 6.28 | `airport_stairs.glb` | Airport boarding stairs on wheels. Stylised game asset, single object, plain background, no text. |
| 6.29 | `airport_fuel_truck.glb` | Aircraft refuelling truck, white with a hose. Stylised game asset, single vehicle, plain background, no text. |
| 6.30 | `boat_canoe.glb` | Long wooden fishing canoe, hand-painted blue and white, with a small outboard motor. Stylised game asset, single boat, plain background, no text. |
| 6.31 | `boat_launch.glb` | Wooden passenger motor launch with a canopy and benches. Stylised game asset, single boat, plain background, no text. |
| 6.32 | `boat_dinghy.glb` | Small wooden rowing dinghy with oars. Stylised game asset, single boat, plain background, no text. |
| 6.33 | `boat_barge.glb` | Cargo barge with a flat deck. Stylised game asset, single boat, plain background, no text. |
| 6.34 | `boat_tug.glb` | Harbour tugboat, red. Stylised game asset, single boat, plain background, no text. |
| 6.35 | `ship_cargo.glb` | Large cargo ship with a red hull, white bridge and funnel, deck stacked with containers. Stylised game asset, single ship, plain background, no text. |

---

## 7. Animals  → `web/public/assets/3d/animals/`

Detail: Medium. Animals do not need a rig; the game will make them sway. (If you do rig them with the tool's animal option, export Walk in the same single file.)

| # | Save as | Prompt |
| --- | --- | --- |
| 7.1 | `cow_brown.glb` | Zebu cow, brown with a white patch, large hump and long horns, standing. Stylised game asset, single animal, plain background. |
| 7.2 | `cow_white.glb` | Zebu cow, white, large hump and long horns, standing. Stylised game asset, single animal, plain background. |
| 7.3 | `cow_black.glb` | Zebu cow, black, large hump, standing. Stylised game asset, single animal, plain background. |
| 7.4 | `goat.glb` | Goat, brown and white, standing. Stylised game asset, single animal, plain background. |
| 7.5 | `sheep.glb` | Sheep, white, standing. Stylised game asset, single animal, plain background. |
| 7.6 | `chicken.glb` | Hen, brown, standing. Stylised game asset, single animal, plain background. |
| 7.7 | `dog.glb` | Village dog, tan, standing. Stylised game asset, single animal, plain background. |
| 7.8 | `horse_royal.glb` | Horse in ornate ceremonial tack with a decorated saddle cloth, standing. Stylised game asset, single animal, plain background. |
| 7.9 | `camel.glb` | Camel with a simple saddle, standing. Stylised game asset, single animal, plain background. |
| 7.10 | `donkey_cart.glb` | Donkey harnessed to a small wooden cart. Stylised game asset, single object, plain background. |

---

## 8. Places

Each place has one **main building or scene** plus a few **extra pieces**. Detail: Heavy for the main one, Medium or Light for pieces.
Every prompt ends with *Stylised game asset, single object, plain background, no text.* (written as "[S]" below only to save space in the table headings; **always add that sentence when you paste**).

Short form used in the tables:
**[S]** = `Stylised game asset, single object, plain background, no text.`

### 8.1 Shared street and market pieces  → `props/street/`

| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.1.1 | `market_stall_a.glb` | Wooden market stall with a striped fabric awning and an empty table. |
| 8.1.2 | `market_stall_b.glb` | Wooden market stall with a plain blue tarpaulin roof and shelves. |
| 8.1.3 | `market_produce_table.glb` | Table piled with tomatoes, peppers, onions, yams and plantains. |
| 8.1.4 | `market_cloth_stall.glb` | Stall with stacked rolls of colourful cloth. |
| 8.1.5 | `market_pots_stall.glb` | Table of clay pots, enamel basins and kitchen utensils. |
| 8.1.6 | `market_umbrella.glb` | Large canvas market umbrella on a pole. |
| 8.1.7 | `market_scale.glb` | Hanging market weighing scale with a pan. |
| 8.1.8 | `crates_wood.glb` | Stack of wooden crates. |
| 8.1.9 | `crates_plastic.glb` | Stack of plastic crates, red and blue. |
| 8.1.10 | `drum_oil.glb` | Metal oil drum. |
| 8.1.11 | `pallet.glb` | Wooden pallet. |
| 8.1.12 | `tyres_stack.glb` | Stack of used tyres. |
| 8.1.13 | `sacks_stack.glb` | Stack of grain sacks. |
| 8.1.14 | `generator.glb` | Small portable petrol generator with an exhaust pipe. |
| 8.1.15 | `chair_plastic.glb` | White plastic garden chair. |
| 8.1.16 | `table_plastic.glb` | White plastic table. |
| 8.1.17 | `bench_wood.glb` | Wooden park bench. |
| 8.1.18 | `stool_wood.glb` | Small wooden stool. |
| 8.1.19 | `lamp_post.glb` | Street lamp post, metal, with a curved arm. |
| 8.1.20 | `pole_electric.glb` | Concrete electricity pole with cables. |
| 8.1.21 | `water_tank_stand.glb` | Black water tank on a metal stand. |
| 8.1.22 | `standpipe.glb` | Public water standpipe with a tap. |
| 8.1.23 | `bin.glb` | Rubbish bin. |
| 8.1.24 | `bollard.glb` | Short concrete bollard. |
| 8.1.25 | `cone_traffic.glb` | Orange traffic cone. |
| 8.1.26 | `barrier_road.glb` | Road barrier with red and white stripes. |
| 8.1.27 | `signboard_blank.glb` | Blank wooden signboard on two posts. |
| 8.1.28 | `fence_wood.glb` | Wooden rail fence section with a gate. |
| 8.1.29 | `fence_chainlink.glb` | Chain-link fence section. |
| 8.1.30 | `bunting.glb` | String of colourful triangle flags. |
| 8.1.31 | `tent_shade.glb` | Open tent canopy on poles with a blue tarpaulin. |
| 8.1.32 | `kiosk_small.glb` | Small painted trading kiosk with a hatch window, no text. |

### 8.2 Open-air venues  → `venues/<venue id>/` (one folder per venue, listed below)

Each venue folder holds the files named in the tables. The first file in each venue is its **main scene** (Heavy).

#### cattle_market  → `venues/cattle_market/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.1 | `cattle_market_main.glb` | Cattle market corner: wooden rail pen with trampled earth, a feed trough and an open feed shed with a tin roof behind. |
| 8.2.2 | `cattle_market_hay.glb` | Stack of hay bales. |
| 8.2.3 | `cattle_market_trough.glb` | Long wooden feed trough. |

#### craft_market  → `venues/craft_market/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.4 | `craft_market_main.glb` | Craft market corner: an adobe wall with colourful cloths hung out to dry and two market stalls with striped awnings. |
| 8.2.5 | `craft_market_loom.glb` | Traditional wooden hand loom weaving strip cloth. |
| 8.2.6 | `craft_market_dye_vat.glb` | Round indigo dye pit with blue cloth hanging on a drying line. |
| 8.2.7 | `craft_market_masks.glb` | Display stand of carved wooden masks and small statues. |
| 8.2.8 | `craft_market_forge.glb` | Small clay bronze-casting furnace with tools. |

#### festival_ground  → `venues/festival_ground/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.9 | `festival_ground_main.glb` | Festival stage: raised platform with a roof on posts, a blank banner, speakers and lights, bunting strung along the front. |
| 8.2.10 | `festival_ground_speakers.glb` | Stack of large speaker cabinets. |
| 8.2.11 | `festival_ground_drum_set.glb` | Row of traditional drums on stands. |
| 8.2.12 | `festival_ground_grill.glb` | Charcoal grill food stall with pots and a hanging awning. |
| 8.2.13 | `festival_ground_pavilion.glb` | Open shade pavilion with a thatched roof on posts. |

#### motor_park  → `venues/motor_park/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.14 | `motor_park_main.glb` | Bus park: a patched canvas awning on poles with a wooden bench, a small ticket kiosk beside it, a blank destinations board. |
| 8.2.15 | `motor_park_kiosk.glb` | Small painted ticket kiosk with a window, no text. |
| 8.2.16 | `motor_park_board.glb` | Blank destinations board on two posts. |
| 8.2.17 | `motor_park_mechanic.glb` | Mechanic's corner with a jack, tools and tyres. |

#### railway_station  → `venues/railway_station/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.18 | `railway_station_main.glb` | Small colonial railway station building with a canopy over the platform, a clock on the wall and a yellow edge line. |
| 8.2.19 | `railway_station_track.glb` | Section of railway track with sleepers and ballast. |
| 8.2.20 | `railway_station_platform_bench.glb` | Platform bench with a back. |
| 8.2.21 | `railway_station_signal.glb` | Railway signal post with lights. |
| 8.2.22 | `railway_station_trolley.glb` | Porter's luggage trolley with bags. |

#### airport  → `venues/airport/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.23 | `airport_main.glb` | Airport terminal front: modern building with a long glass band, a canopy over the entrance and a blank roof sign. |
| 8.2.24 | `airport_checkin.glb` | Row of check-in desks with a canopy and a luggage conveyor. |
| 8.2.25 | `airport_tower.glb` | Airport control tower. |
| 8.2.26 | `airport_trolley.glb` | Airport luggage trolley. |
| 8.2.27 | `airport_security_gate.glb` | Security scanner arch and tray table. |
| 8.2.28 | `airport_hangar.glb` | Aircraft hangar with sliding doors. |

#### beach  → `venues/beach/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.29 | `beach_main.glb` | Sandy beach corner with a lifeguard tower on stilts with a flag, two palm trees and a wooden fishing boat drawn up on the sand. |
| 8.2.30 | `beach_lifeguard_tower.glb` | Lifeguard tower on stilts with a flag. |
| 8.2.31 | `beach_net_rack.glb` | Wooden rack with a fishing net drying. |
| 8.2.32 | `beach_umbrella.glb` | Beach umbrella with two loungers. |
| 8.2.33 | `beach_palm.glb` | Coconut palm tree. |

#### fishing_jetty  → `venues/fishing_jetty/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.34 | `fishing_jetty_main.glb` | Wooden fishing jetty on pilings with planks, mooring posts and a small ticket hut. |
| 8.2.35 | `fishing_jetty_hut.glb` | Small ticket hut with a window. |
| 8.2.36 | `fishing_jetty_fish_crates.glb` | Crates of fresh fish and a heap of nets. |

#### jetty  → `venues/jetty/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.37 | `jetty_main.glb` | Passenger pier with concrete steps and a covered launch moored alongside, a ticket table with an umbrella. |
| 8.2.38 | `jetty_route_board.glb` | Blank route board on a post. |
| 8.2.39 | `jetty_luggage.glb` | Pile of passenger luggage. |

#### waterfront  → `venues/waterfront/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.40 | `waterfront_main.glb` | Lagoon waterfront: a warehouse with a blank sign over the door beside a muddy landing with boats pulled up. |
| 8.2.41 | `waterfront_baskets.glb` | Fish sellers' baskets and a small food stall. |
| 8.2.42 | `waterfront_bollards.glb` | Row of iron mooring bollards with ropes. |

#### seaport  → `venues/seaport/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.43 | `seaport_main.glb` | Container port quay: a large gantry crane over stacked containers and a customs shed. |
| 8.2.44 | `seaport_crane.glb` | Portal gantry crane with a container hanging from the trolley. |
| 8.2.45 | `seaport_containers.glb` | Stack of shipping containers in red, blue and green. |
| 8.2.46 | `seaport_customs_shed.glb` | Customs shed, low building with a blank sign. |
| 8.2.47 | `seaport_forklift.glb` | Yellow forklift. |

#### farm  → `venues/farm/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.48 | `farm_main.glb` | Small farm: a simple farmhouse with a tin roof beside a sorting shed with produce crates and a water tank on a stand. |
| 8.2.49 | `farm_crop_rows.glb` | Field patch of crop rows, maize and cassava. |
| 8.2.50 | `farm_yam_mounds.glb` | Field patch of yam mounds. |
| 8.2.51 | `farm_goat_pen.glb` | Wooden goat pen with a lantern. |
| 8.2.52 | `farm_scarecrow.glb` | Scarecrow in old clothes. |

#### mining_site  → `venues/mining_site/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.53 | `mining_site_main.glb` | Quarry edge: heaps of rock, a conveyor belt climbing out of the pit, a portable site cabin. |
| 8.2.54 | `mining_site_conveyor.glb` | Inclined conveyor belt with a hopper. |
| 8.2.55 | `mining_site_crusher.glb` | Rock crusher machine. |
| 8.2.56 | `mining_site_cabin.glb` | Portable site office cabin. |
| 8.2.57 | `mining_site_rock_heap.glb` | Heap of broken grey rock. |

#### refinery  → `venues/refinery/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.58 | `refinery_main.glb` | Oil refinery corner: large white storage tanks, a pipe rack and a flare stack with a flame. |
| 8.2.59 | `refinery_tank.glb` | Large round white storage tank. |
| 8.2.60 | `refinery_flare_stack.glb` | Tall flare stack with a flame. |
| 8.2.61 | `refinery_pipes.glb` | Pipe rack with large pipes. |
| 8.2.62 | `refinery_cabin.glb` | Control cabin building with a window. |

#### factory_gate  → `venues/factory_gate/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.63 | `factory_gate_main.glb` | Factory front: a long plain wall with a sawtooth roof, loading doors, a tall chimney and a gate with a guard house. |
| 8.2.64 | `factory_gate_guardhouse.glb` | Small guard house with a barrier arm. |
| 8.2.65 | `factory_gate_chimney.glb` | Tall factory chimney. |

#### conservation_office  → `venues/conservation_office/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.2.66 | `conservation_office_main.glb` | Park office: a cream single-storey building with a green roof and a veranda, notice boards by the door. |
| 8.2.67 | `conservation_office_mast.glb` | Radio mast. |
| 8.2.68 | `conservation_office_noticeboard.glb` | Wooden notice board with a roof. |

### 8.3 Building venues (18)  → `venues/<venue id>/`

Each venue has a **front of the building** (main, Heavy) and **a few extra pieces**, plus one **interior** where the story happens
(the inside is the second Heavy file). Interiors are shown as a cutaway room with the front open.

#### church  → `venues/church/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.1 | `church_main.glb` | Nigerian church front: gabled roof, tall bell tower with a cross, arched stained-glass windows, wide double doors with steps. |
| 8.3.2 | `church_interior.glb` | Church interior: rows of wooden pews, a pulpit and an altar with a cross, cutaway room. |
| 8.3.3 | `church_noticeboard.glb` | Church notice board with a small roof, blank. |

#### mosque  → `venues/mosque/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.4 | `mosque_main.glb` | Mosque front: one central dome, two slender minarets with loudspeakers and crescents, an arched doorway. |
| 8.3.5 | `mosque_interior.glb` | Mosque interior: prayer carpet with rows, a mihrab niche and a minbar, cutaway room. |
| 8.3.6 | `mosque_ablution.glb` | Ablution area with a row of taps and low stools. |

#### sacred_grove  → `venues/sacred_grove/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.7 | `sacred_grove_main.glb` | Sacred forest clearing with very old giant trees, a small shrine with white cloth, clay pots and carved wooden posts. |
| 8.3.8 | `sacred_grove_shrine.glb` | Small shrine with offerings, calabashes and white cloth. |
| 8.3.9 | `sacred_grove_shelter.glb` | Open thatched shelter on posts. |

#### police_station  → `venues/police_station/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.10 | `police_station_main.glb` | Single-storey concrete police station with barred windows, flagpole and a security barrier. |
| 8.3.11 | `police_station_interior.glb` | Police station interior: a front desk, a counter, a holding cell with bars, notice boards, cutaway room. |
| 8.3.12 | `police_station_barrier.glb` | Security barrier arm with a booth. |

#### hospital  → `venues/hospital/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.13 | `hospital_main.glb` | Two-storey hospital front with an ambulance bay, a covered porch and a blank sign above. |
| 8.3.14 | `hospital_interior.glb` | Hospital interior: reception desk, waiting chairs, a ward with two beds and curtains, cutaway room. |
| 8.3.15 | `hospital_wheelchair.glb` | Wheelchair. |
| 8.3.16 | `hospital_stretcher.glb` | Hospital stretcher bed. |

#### community_hall  → `venues/community_hall/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.17 | `community_hall_main.glb` | Community hall: wide building with a tin roof and an open front with steps. |
| 8.3.18 | `community_hall_interior.glb` | Community hall interior: rows of chairs and a small raised stage, cutaway room. |

#### traditional_council  → `venues/traditional_council/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.19 | `traditional_council_main.glb` | Traditional council hall: long building with a deep veranda, carved wooden posts and a tin roof. |
| 8.3.20 | `traditional_council_interior.glb` | Council hall interior: carved chiefs' seats in a semicircle, a low table with records books, cutaway room. |
| 8.3.21 | `traditional_council_throne.glb` | Carved wooden chief's seat. |

#### emir_palace  → `venues/emir_palace/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.22 | `emir_palace_main.glb` | Northern Nigerian emir's palace gate: mud-brick wall with an arched entrance, crenellations and decorated doors. |
| 8.3.23 | `emir_palace_courtyard.glb` | Palace courtyard with a stable and a guard post. |
| 8.3.24 | `emir_palace_umbrella.glb` | Ceremonial fan and umbrella on poles. |

#### palace  → `venues/palace/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.25 | `palace_main.glb` | Royal palace front: a grand building with columns, flags and a grand double door, guard boxes. |
| 8.3.26 | `palace_interior.glb` | Palace hall interior: a throne on a platform, columns, ceremonial seats, cutaway room. |
| 8.3.27 | `palace_guard_box.glb` | Guard box. |

#### museum  → `venues/museum/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.28 | `museum_main.glb` | Museum front with columns and wide steps, blank banners on the columns. |
| 8.3.29 | `museum_interior.glb` | Museum gallery: glass display cases on plinths with a bronze head, masks and pottery, cutaway room. |
| 8.3.30 | `museum_display_case.glb` | Glass display case on a plinth. |
| 8.3.31 | `museum_bronze_head.glb` | Benin-style bronze head on a plinth. |

#### library  → `venues/library/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.32 | `library_main.glb` | Brick library building with large windows and a wide door. |
| 8.3.33 | `library_interior.glb` | Library interior: tall full bookshelves with a rolling ladder, reading tables with lamps, cutaway room. |
| 8.3.34 | `library_bookshelf.glb` | Tall wooden bookshelf full of books. |

#### university  → `venues/university/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.35 | `university_main.glb` | University lecture-hall block: modern building with a covered walkway and large windows. |
| 8.3.36 | `university_interior.glb` | Lecture hall interior: rising rows of seats, a blackboard and a lectern, cutaway room. |
| 8.3.37 | `university_lectern.glb` | Lectern with a microphone. |

#### monument  → `venues/monument/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.38 | `monument_main.glb` | National monument: a tall abstract sculpture on a stone plinth with a plaque, a paved plaza and three flagpoles. |
| 8.3.39 | `monument_plaque.glb` | Stone plaque, blank. |

#### radio_station  → `venues/radio_station/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.40 | `radio_station_main.glb` | Low concrete building with a tall radio mast on the roof and an "on air" light by the door. |
| 8.3.41 | `radio_station_interior.glb` | Radio studio: mixing desk, microphones on arms, a glass booth, cutaway room. |
| 8.3.42 | `radio_station_mast.glb` | Radio mast with a base cabin. |

#### carnival_workshop  → `venues/carnival_workshop/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.43 | `carnival_workshop_main.glb` | Large workshop shed with a roller door; colourful costumes on racks and mannequins at the front. |
| 8.3.44 | `carnival_workshop_interior.glb` | Costume workshop interior: sewing tables, feather headdresses, drums, paint pots, cutaway room. |
| 8.3.45 | `carnival_workshop_mannequin.glb` | Mannequin in a feathered carnival costume. |

#### hotel  → `venues/hotel/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.46 | `hotel_main.glb` | Three-storey modern hotel with a canopy entrance, blank sign and potted plants. |
| 8.3.47 | `hotel_interior.glb` | Hotel lobby: reception desk, key board, sofa, plant, luggage trolley, cutaway room. |
| 8.3.48 | `hotel_trolley.glb` | Brass luggage trolley with bags. |

#### restaurant  → `venues/restaurant/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.49 | `restaurant_main.glb` | Small restaurant front with an open front, tables and chairs outside and a blank menu board. |
| 8.3.50 | `restaurant_interior.glb` | Restaurant interior: tables and chairs, a serving counter and a kitchen pass with pots, cutaway room. |
| 8.3.51 | `restaurant_kitchen.glb` | Kitchen with a cooker, pots and a counter. |

#### nightclub  → `venues/nightclub/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.3.52 | `nightclub_main.glb` | Boxy nightclub building with glowing neon strips, a velvet rope and a barrier at the door. |
| 8.3.53 | `nightclub_interior.glb` | Nightclub interior: a bar counter with stools, a DJ booth, speakers and disco lights, cutaway room. |
| 8.3.54 | `nightclub_dj_booth.glb` | DJ booth with turntables and speakers. |

### 8.4 The original market venue  → `venues/market/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 8.4.1 | `market_main.glb` | Busy open-air market corner: three stalls with different coloured awnings, a painted shop-front wall behind, baskets and sacks. |
| 8.4.2 | `market_shopfront.glb` | Painted shop front wall with three doors and blank signs. |

---

## 9. The three chase cities and the journey  → `web/public/assets/3d/chase/` and `web/public/assets/3d/journey/`

Detail: Heavy for buildings, Medium for the rest.

### 9.1 Chase scenery  → `chase/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 9.1.1 | `lagos_tower_a.glb` | Twelve-storey glass office tower, blue-green glass. |
| 9.1.2 | `lagos_tower_b.glb` | Fifteen-storey concrete apartment block with balconies. |
| 9.1.3 | `lagos_tower_c.glb` | Ten-storey white office tower with a rooftop mast. |
| 9.1.4 | `lagos_palm.glb` | Tall coconut palm tree. |
| 9.1.5 | `lagos_lighthouse.glb` | Red and white lighthouse. |
| 9.1.6 | `lagos_bridge.glb` | Long cable-stayed bridge over water, side view, white cables. |
| 9.1.7 | `lagos_fishing_boat.glb` | Wooden fishing boat with a small canopy. |
| 9.1.8 | `lagos_seawall.glb` | Concrete seawall section, straight. |
| 9.1.9 | `lagos_billboard.glb` | Roadside billboard on two posts, blank. |
| 9.1.10 | `anambra_shopfront_a.glb` | Two-storey market shopfront with a painted board and an awning. |
| 9.1.11 | `anambra_shopfront_b.glb` | Two-storey shopfront with stacked goods outside. |
| 9.1.12 | `anambra_market_stall.glb` | Market stall with a bright striped awning and goods. |
| 9.1.13 | `anambra_bridge.glb` | Steel arch bridge with three arches over a river, side view. |
| 9.1.14 | `kano_pyramid.glb` | Large pyramid of stacked groundnut sacks. |
| 9.1.15 | `kano_house_a.glb` | Mud-brick house with decorative relief patterns and a flat roof. |
| 9.1.16 | `kano_house_b.glb` | Two-storey mud-brick house with arched windows. |
| 9.1.17 | `kano_baobab.glb` | Large baobab tree. |
| 9.1.18 | `kano_dala_hill.glb` | Rocky hill, wide, side view. |
| 9.1.19 | `kano_minaret.glb` | Mud-brick mosque tower with decoration. |
| 9.1.20 | `gantry_city_gate.glb` | Large roadside gantry arch spanning a road with a blank wide board. |
| 9.1.21 | `road_sign_a.glb` | Roadside sign post with a blank blue board. |
| 9.1.22 | `bus_stop_shelter.glb` | Bus stop shelter with a bench and a roof. |
| 9.1.23 | `tree_neem.glb` | Neem tree with a rounded crown. |
| 9.1.24 | `tree_mango.glb` | Mango tree with dense leaves. |
| 9.1.25 | `tree_flame.glb` | Flame tree with red flowers. |
| 9.1.26 | `bush_a.glb` | Green bush, low. |
| 9.1.27 | `rock_a.glb` | Grey boulder. |

### 9.2 Journey scenery  → `journey/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 9.2.1 | `journey_tree.glb` | Savanna acacia tree with a flat crown. |
| 9.2.2 | `journey_palm.glb` | Palm tree. |
| 9.2.3 | `journey_pine.glb` | Pine tree. |
| 9.2.4 | `journey_baobab.glb` | Baobab tree. |
| 9.2.5 | `journey_cactus.glb` | Large cactus. |
| 9.2.6 | `journey_rock.glb` | Large rock formation. |
| 9.2.7 | `journey_bush.glb` | Green scrub bush. |
| 9.2.8 | `journey_reed.glb` | Clump of tall reeds. |
| 9.2.9 | `journey_crop_field.glb` | Square patch of green crop field. |
| 9.2.10 | `journey_hut.glb` | Round mud hut with a thatched roof. |
| 9.2.11 | `journey_stall.glb` | Roadside stall with a tarpaulin roof. |
| 9.2.12 | `journey_building.glb` | Small town building, two storeys. |
| 9.2.13 | `journey_boat.glb` | Wooden river boat. |
| 9.2.14 | `journey_pole.glb` | Wooden utility pole with wires. |
| 9.2.15 | `journey_hill.glb` | Rolling green hill, wide. |
| 9.2.16 | `journey_garage.glb` | Small roadside garage workshop with a roller door, no sign. |
| 9.2.17 | `journey_busstop.glb` | Roadside bus stop with a shelter. |
| 9.2.18 | `journey_bus_parked.glb` | Parked yellow minibus, side view. |
| 9.2.19 | `journey_billboard.glb` | Roadside billboard on posts, blank. |
| 9.2.20 | `journey_terminal.glb` | Airport terminal building. |
| 9.2.21 | `journey_tower.glb` | Airport control tower. |
| 9.2.22 | `journey_hangar.glb` | Aircraft hangar. |
| 9.2.23 | `journey_cloud_a.glb` | Fluffy cumulus cloud, white, flat bottom. |
| 9.2.24 | `journey_cloud_b.glb` | Long thin stretched cloud, white. |

---

## 10. Inside rooms  → `web/public/assets/3d/interiors/`

Detail: Medium unless stated. Whole-room scenes are **cutaway** (front wall removed, like a doll's house) so the camera can look in.

### 10.1 Case office  → `interiors/office/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 10.1.1 | `office_room.glb` | Small 1990s detective office, cutaway room: wooden desk with drawers, filing cabinet, window with curtains, corkboard on the wall, plant in a pot, wooden floor, front wall removed. Heavy. |
| 10.1.2 | `office_desk.glb` | Wooden office desk with drawers, plain top. |
| 10.1.3 | `office_monitor.glb` | Old CRT computer monitor on a stand, screen plain black, with keyboard and mouse. |
| 10.1.4 | `office_lamp.glb` | Green-shaded desk lamp with a brass base. |
| 10.1.5 | `office_chair.glb` | Worn leather office chair with casters. |
| 10.1.6 | `office_filing_cabinet.glb` | Steel four-drawer filing cabinet. |
| 10.1.7 | `office_corkboard.glb` | Corkboard in a wooden frame, plain. |
| 10.1.8 | `office_plant.glb` | Leafy indoor plant in a pot. |
| 10.1.9 | `office_papers.glb` | Stack of loose papers, a closed folder and a coffee mug. |
| 10.1.10 | `office_window.glb` | Window with a wooden frame, sill and curtains. |

### 10.2 Garage  → `interiors/garage/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 10.2.1 | `garage_room.glb` | Car garage, cutaway room: concrete floor with painted bay lines, a roller shutter, a workbench, shelves with oil cans, tyres and oil drums, front wall removed. Heavy. |
| 10.2.2 | `garage_workbench.glb` | Metal workbench with tools on a pegboard. |
| 10.2.3 | `garage_shelf.glb` | Metal shelf with oil cans. |
| 10.2.4 | `garage_shutter.glb` | Roller shutter door, half open. |
| 10.2.5 | `garage_tool_rack.glb` | Rack of hand tools. |

### 10.3 Archive  → `interiors/archive/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 10.3.1 | `archive_room.glb` | Records archive, cutaway room: tall wooden shelving full of labelled archive boxes, a rolling ladder, a table with a lamp, front wall removed. Heavy. |
| 10.3.2 | `archive_shelf.glb` | Tall wooden shelving unit full of archive boxes. |
| 10.3.3 | `archive_ladder.glb` | Rolling library ladder. |
| 10.3.4 | `archive_table.glb` | Wooden table with a desk lamp and folders. |
| 10.3.5 | `archive_pendant_lamp.glb` | Hanging pendant lamp with a metal shade. |
| 10.3.6 | `archive_box.glb` | Archive storage box with a blank label. |
| 10.3.7 | `archive_cabinet.glb` | Wooden card catalogue cabinet with many small drawers. |

### 10.4 Disciplinary panel hall  → `interiors/panel/`
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 10.4.1 | `panel_hall.glb` | Formal hearing room, cutaway: wood-panelled walls, a long wide judges' bench with five seats on a raised platform, a flag, a clock, front wall removed. Heavy. |
| 10.4.2 | `panel_bench.glb` | Long wooden judges' bench with five blank nameplates. |
| 10.4.3 | `panel_chair.glb` | High-backed leather judge's chair. |
| 10.4.4 | `panel_gavel.glb` | Wooden gavel and block. |
| 10.4.5 | `panel_water_jug.glb` | Water jug and glasses on a tray. |
| 10.4.6 | `panel_flag.glb` | Flag on a pole, plain green and white. |

### 10.5 Case items  → `interiors/items/`
Light detail.
| # | Save as | Prompt (add [S]) |
| --- | --- | --- |
| 10.5.1 | `item_folder.glb` | Manila case folder, closed. |
| 10.5.2 | `item_notebook.glb` | Small black notebook, closed. |
| 10.5.3 | `item_magnifier.glb` | Magnifying glass with a wooden handle. |
| 10.5.4 | `item_passport.glb` | Green passport booklet, no text. |
| 10.5.5 | `item_tickets.glb` | Small bundle of paper tickets. |
| 10.5.6 | `item_keys.glb` | Bunch of keys on a ring. |
| 10.5.7 | `item_coins.glb` | Small pile of coins. |
| 10.5.8 | `item_evidence_bag.glb` | Clear evidence bag with a small object inside. |
| 10.5.9 | `item_photographs.glb` | Small stack of photographs. |
| 10.5.10 | `item_map.glb` | Folded paper map, blank. |

---

## 11. Textures, cloth patterns and skies  → `web/public/assets/3d/textures/`

These are **pictures**, not 3D models. Use the tool's **texture** feature, or any image generator (ChatGPT, Midjourney, etc.).
Save as **.jpg** (or .png). Tell the generator "seamless, tileable, square" so the edges join up.

| # | Save as | Prompt |
| --- | --- | --- |
| 11.1 | `tex_asphalt.jpg` | Seamless tileable asphalt road texture, top-down, cracks and wear, no marks. |
| 11.2 | `tex_concrete.jpg` | Seamless tileable concrete texture, top-down. |
| 11.3 | `tex_brick.jpg` | Seamless tileable red brick wall texture. |
| 11.4 | `tex_mud_wall.jpg` | Seamless tileable adobe mud wall texture. |
| 11.5 | `tex_plaster.jpg` | Seamless tileable painted plaster wall texture, cream. |
| 11.6 | `tex_tin_roof.jpg` | Seamless tileable corrugated tin roof texture, slightly rusty. |
| 11.7 | `tex_clay_tiles.jpg` | Seamless tileable clay roof tile texture. |
| 11.8 | `tex_wood_planks.jpg` | Seamless tileable wooden planks texture. |
| 11.9 | `tex_grass.jpg` | Seamless tileable grass texture, top-down. |
| 11.10 | `tex_dirt.jpg` | Seamless tileable dry red dirt texture, top-down. |
| 11.11 | `tex_sand.jpg` | Seamless tileable beach sand texture, top-down. |
| 11.12 | `tex_gravel.jpg` | Seamless tileable gravel texture. |
| 11.13 | `tex_floor_tile.jpg` | Seamless tileable cream floor tile texture. |
| 11.14 | `tex_carpet.jpg` | Seamless tileable dark red carpet texture. |
| 11.15 | `tex_water.jpg` | Seamless tileable sea water ripple texture, top-down, teal. |
| 11.16 | `fabric_ankara_01.jpg` | Seamless tileable Ankara wax-print cloth pattern, bold geometric shapes in blue, orange and cream, original design, no text. |
| 11.17 | `fabric_ankara_02.jpg` | Seamless tileable Ankara wax-print pattern, large flowers in red, yellow and green, original design, no text. |
| 11.18 | `fabric_ankara_03.jpg` | Seamless tileable Ankara wax-print pattern, circles and waves in purple and gold, original design, no text. |
| 11.19 | `fabric_ankara_04.jpg` | Seamless tileable Ankara pattern, leaves and dots in green and cream, original design, no text. |
| 11.20 | `fabric_ankara_05.jpg` | Seamless tileable Ankara pattern, bold stripes and diamonds in red and black, original design, no text. |
| 11.21 | `fabric_adire.jpg` | Seamless tileable adire indigo tie-dye resist cloth pattern, deep blue and white. |
| 11.22 | `fabric_aso_oke.jpg` | Seamless tileable woven aso-oke strip cloth, gold and burgundy stripes. |
| 11.23 | `sky_dawn.jpg` | Wide panorama sky at dawn, soft pink and orange, no sun glare, no ground, 2:1 ratio. |
| 11.24 | `sky_day.jpg` | Wide panorama clear blue sky with a few clouds, no ground, 2:1 ratio. |
| 11.25 | `sky_dusk.jpg` | Wide panorama sky at golden dusk, no ground, 2:1 ratio. |
| 11.26 | `sky_night.jpg` | Wide panorama starry night sky with a moon, no ground, 2:1 ratio. |

### 11.1 Effects (pictures on a see-through background)  → `textures/fx/`
Ask the image tool for a "PNG with a transparent background".
| # | Save as | Prompt |
| --- | --- | --- |
| 11.27 | `fx_flame.png` | Soft orange flame, single, transparent background. |
| 11.28 | `fx_smoke.png` | Soft grey smoke puff, transparent background. |
| 11.29 | `fx_dust.png` | Light brown dust puff, transparent background. |
| 11.30 | `fx_glow.png` | Soft round warm light glow, transparent background. |
| 11.31 | `fx_foam.png` | White sea foam splash, transparent background. |
| 11.32 | `fx_spark.png` | Cluster of bright sparks, transparent background. |

---

## 12. Folder layout at a glance

```
web/public/assets/3d/
  characters/   avatars/  witnesses/  judges/  crowd/
  props/        held/  street/
  vehicles/
  animals/
  venues/       market/ cattle_market/ craft_market/ festival_ground/ motor_park/ railway_station/ airport/
                beach/ fishing_jetty/ jetty/ waterfront/ seaport/ farm/ mining_site/ refinery/ factory_gate/
                conservation_office/ church/ mosque/ sacred_grove/ police_station/ hospital/ community_hall/
                traditional_council/ emir_palace/ palace/ museum/ library/ university/ monument/
                radio_station/ carnival_workshop/ hotel/ restaurant/ nightclub/
  chase/
  journey/
  interiors/    office/ garage/ archive/ panel/ items/
  textures/     fx/
```

## 13. Totals and suggested order

About **350 files**: 10 avatars, 16 witnesses, 5 judges, 24 crowd, 20 held items, 35 vehicles, 10 animals,
32 street pieces, about 160 venue pieces, 51 chase and journey pieces, about 40 interior pieces, and 32 pictures.

Work in this order, because each group is useful on its own and the game keeps working with the shapes it already has until a file arrives:

1. **Sections 4.1 and 6.1, 6.2, 10.1, 10.2** (the avatars, the player's car, the danfo, the office and garage): the first things the player sees.
2. **Section 4.3, 10.4** (judges and the hearing room).
3. **Sections 8.1, 8.2** (market and open-air venues), then **4.2, 4.4** (witnesses and crowd).
4. **Section 6** (rest of the vehicles) and **7** (animals).
5. **Section 8.3** (the 18 buildings).
6. **Sections 9 and 10.3** (chase, journey, archive).
7. **Section 11** (textures) and **5, 10.5** (small items).

## 14. When a result is bad

| Problem | What to do |
| --- | --- |
| Shape melted or has holes | Regenerate. Add "simple clean shape, solid" to the prompt. |
| Lettering or a logo appears | Regenerate. Add "no text, no letters, no logo" again. |
| It made several objects | Add "single object only" to the prompt. |
| Character's hands or face are a mess | Regenerate; many tries are normal. Add "natural hands, five fingers". |
| The rig looks twisted when animated | Re-generate in a plain A-pose; remove props from the hands in the prompt. |
| Too heavy / slow in the game | Lower the detail level in the tool and download again. |
| You cannot get something right after 5 tries | Skip it and tell me; I'll keep the shapes the game already draws. |
