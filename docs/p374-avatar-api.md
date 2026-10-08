# P3.7.4 frontend handoff — procedural avatars

The backend exposes ten complete avatar presets. The frontend must render them
from Babylon.js primitives; do not load GLB/GLTF models and do not invent or
submit individual appearance fields.

## First-login flow

1. After registration confirmation or login, read `player.avatar_setup_complete`
   from the authentication response.
2. If it is `false`, route to the avatar picker before the case desk.
3. Fetch `GET /v1/avatar/options` with the session cookie.
4. Render all ten options as selectable cards. Each card needs a Babylon.js
   preview and the API `label` as accessible text.
5. Save the chosen stable ID with `PUT /v1/profile/avatar` and JSON
   `{ "avatar_id": "avatar-01" }`.
6. Continue only when the response has `setup_complete: true`. Keep the same
   picker available later from Settings; the PUT operation is idempotent.

All calls use `credentials: "include"`. PUT must also send the normal allowed
`Origin`; CSRF/origin rules are identical to the other authenticated writes.

## Exact contracts

`GET /v1/avatar/options` returns:

```json
{
  "catalogue_version": 1,
  "renderer": "babylon_procedural_v1",
  "options": [
    {
      "avatar_id": "avatar-01",
      "label": "Emerald Braids",
      "presentation": "feminine",
      "skin_tone": "deep",
      "skin_color": "#4A2B20",
      "hair_style": "braided_bun",
      "hair_color": "#18120F",
      "uniform_primary": "#176B4D",
      "uniform_secondary": "#F4E8C1",
      "uniform_accent": "#E5B94B"
    }
  ]
}
```

The real response always contains exactly ten options. `GET /v1/profile/avatar`
and a successful PUT return:

```json
{
  "catalogue_version": 1,
  "setup_complete": true,
  "selected_avatar_id": "avatar-01",
  "selected": { "avatar_id": "avatar-01", "label": "Emerald Braids" }
}
```

`selected` contains the full preset, abbreviated above. An unknown ID returns
HTTP 400. Authentication failure returns 401. Do not cache a catalogue across a
version change.

## Babylon.js renderer contract

Use one shared procedural character function. A sphere or low-poly ellipsoid is
enough for the head; capsules/cylinders are enough for torso and limbs. Apply
`skin_color`, `hair_color`, and the three uniform colours directly as materials.
Map `hair_style` to small primitive arrangements (caps, tubes, or spheres), not
downloaded assets. `presentation` may vary silhouette proportions subtly, but it
must not change animations, abilities, hit boxes, or gameplay.

Keep camera, lighting, pose, and scale identical for all ten cards so selection
is comparable. If WebGL is unavailable or performance mode is active, show a
CSS/SVG-style colour silhouette assembled from the same fields and label; never
replace the server IDs with browser-only presets.

Selection must work by touch and keyboard, expose a visible focus state and
selected state, announce errors, respect reduced motion, and avoid conveying
skin tone by colour alone. The labels are display labels, not player names.
