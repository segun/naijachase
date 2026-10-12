# Missing 3D models: prompts to finish the set

49 models are still to make (checked on 2026-10-12 against `docs/3d-generator-prompts.md`). Every prompt below already includes the style sentence, so paste it as it is.

- **Folders** are under `web/public/assets/3d/`. Create the ones that don't exist yet (`venues/beach/`, `venues/fishing_jetty/`, `venues/jetty/`, `venues/waterfront/`,
  `venues/seaport/`, `venues/farm/`, `venues/mining_site/`, `props/held/`).
- **Tripo settings:** HD Model, Ultra Mesh Quality off, texture 2K, PBR off, Triangle, polycount about 1,000 for the held items and the small pieces, about 10,000 for the
  `_main` scenes. Export as GLB with **Export Skeleton off** (none of these move).
- Save each file with exactly the name in the table (lowercase, underscores).
- Afterwards, run `pnpm assets:optimize` in `web/`. [3d-asset-progress.md](./3d-asset-progress.md) is updated by it and lists whatever is still missing.

Suggested order: the 7 venues first (29 files), then the held items (20 files).

## Venues (29 files)

### `venues/beach/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `beach_main.glb` | Sandy beach corner with a lifeguard tower on stilts with a flag, two palm trees and a wooden fishing boat drawn up on the sand. Stylised game asset, single object, plain background, no text. |
| [ ] | `beach_lifeguard_tower.glb` | Lifeguard tower on stilts with a flag. Stylised game asset, single object, plain background, no text. |
| [ ] | `beach_net_rack.glb` | Wooden rack with a fishing net drying. Stylised game asset, single object, plain background, no text. |
| [ ] | `beach_umbrella.glb` | Beach umbrella with two loungers. Stylised game asset, single object, plain background, no text. |
| [ ] | `beach_palm.glb` | Coconut palm tree. Stylised game asset, single object, plain background, no text. |

### `venues/fishing_jetty/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `fishing_jetty_main.glb` | Wooden fishing jetty on pilings with planks, mooring posts and a small ticket hut. Stylised game asset, single object, plain background, no text. |
| [ ] | `fishing_jetty_hut.glb` | Small ticket hut with a window. Stylised game asset, single object, plain background, no text. |
| [ ] | `fishing_jetty_fish_crates.glb` | Crates of fresh fish and a heap of nets. Stylised game asset, single object, plain background, no text. |

### `venues/jetty/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `jetty_main.glb` | Passenger pier with concrete steps and a covered launch moored alongside, a ticket table with an umbrella. Stylised game asset, single object, plain background, no text. |
| [ ] | `jetty_route_board.glb` | Blank route board on a post. Stylised game asset, single object, plain background, no text. |
| [ ] | `jetty_luggage.glb` | Pile of passenger luggage. Stylised game asset, single object, plain background, no text. |

### `venues/waterfront/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `waterfront_main.glb` | Lagoon waterfront: a warehouse with a blank sign over the door beside a muddy landing with boats pulled up. Stylised game asset, single object, plain background, no text. |
| [ ] | `waterfront_baskets.glb` | Fish sellers' baskets and a small food stall. Stylised game asset, single object, plain background, no text. |
| [ ] | `waterfront_bollards.glb` | Row of iron mooring bollards with ropes. Stylised game asset, single object, plain background, no text. |

### `venues/seaport/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `seaport_main.glb` | Container port quay: a large gantry crane over stacked containers and a customs shed. Stylised game asset, single object, plain background, no text. |
| [ ] | `seaport_crane.glb` | Portal gantry crane with a container hanging from the trolley. Stylised game asset, single object, plain background, no text. |
| [ ] | `seaport_containers.glb` | Stack of shipping containers in red, blue and green. Stylised game asset, single object, plain background, no text. |
| [ ] | `seaport_customs_shed.glb` | Customs shed, low building with a blank sign. Stylised game asset, single object, plain background, no text. |
| [ ] | `seaport_forklift.glb` | Yellow forklift. Stylised game asset, single object, plain background, no text. |

### `venues/farm/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `farm_main.glb` | Small farm: a simple farmhouse with a tin roof beside a sorting shed with produce crates and a water tank on a stand. Stylised game asset, single object, plain background, no text. |
| [ ] | `farm_crop_rows.glb` | Field patch of crop rows, maize and cassava. Stylised game asset, single object, plain background, no text. |
| [ ] | `farm_yam_mounds.glb` | Field patch of yam mounds. Stylised game asset, single object, plain background, no text. |
| [ ] | `farm_goat_pen.glb` | Wooden goat pen with a lantern. Stylised game asset, single object, plain background, no text. |
| [ ] | `farm_scarecrow.glb` | Scarecrow in old clothes. Stylised game asset, single object, plain background, no text. |

### `venues/mining_site/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `mining_site_main.glb` | Quarry edge: heaps of rock, a conveyor belt climbing out of the pit, a portable site cabin. Stylised game asset, single object, plain background, no text. |
| [ ] | `mining_site_conveyor.glb` | Inclined conveyor belt with a hopper. Stylised game asset, single object, plain background, no text. |
| [ ] | `mining_site_crusher.glb` | Rock crusher machine. Stylised game asset, single object, plain background, no text. |
| [ ] | `mining_site_cabin.glb` | Portable site office cabin. Stylised game asset, single object, plain background, no text. |
| [ ] | `mining_site_rock_heap.glb` | Heap of broken grey rock. Stylised game asset, single object, plain background, no text. |

## Things people carry (20 files)

### `props/held/`

| Done | Save as | Prompt |
| --- | --- | --- |
| [ ] | `held_baton.glb` | Short black police baton with a rubber grip. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_sack.glb` | Tied burlap sack, full, standing. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_basket.glb` | Large round woven basket for carrying on the head, empty. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_hoe.glb` | Wooden-handled farming hoe with a metal blade. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_briefcase.glb` | Brown leather briefcase with a handle. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_handbag.glb` | Woman's leather handbag with a shoulder strap. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_backpack.glb` | Canvas backpack. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_suitcase.glb` | Hard travel suitcase on wheels. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_clipboard.glb` | Clipboard holding blank paper. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_phone.glb` | Smartphone with a plain black screen. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_umbrella.glb` | Black open umbrella. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_jerrycan.glb` | Yellow plastic jerrycan. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_bucket.glb` | Metal bucket. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_tray.glb` | Round serving tray with glasses. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_talking_drum.glb` | Nigerian talking drum, hourglass shape with leather cords. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_vote_paper.glb` | Rectangular card on a wooden stick, flat, blank, left side green and right side red. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_fishing_net.glb` | Fishing net bundled in a heap. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_megaphone.glb` | Handheld megaphone. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_camera.glb` | Old-style camera with a lens. Stylised game asset, single object, plain background, no text. |
| [ ] | `held_broom.glb` | Straw broom with a wooden handle. Stylised game asset, single object, plain background, no text. |
