import { createWitnessScene } from "./scenes/witness/chase3d-witness.ts";
import { recipeFor } from "./scenes/witness/venue-recipes.ts";
const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const text = "A trader leans in: the buyer asked for the road to the big river city and paid in crisp notes, and he was tall with a scar on his chin. I also noticed the suspect was wearing a red cap.";
const h = await createWitnessScene(canvas, {
  preset: { avatar_id: "p", label: "p", presentation: "masculine", skin_tone: "brown", skin_color: "#7a4f35", hair_style: "fade", hair_color: "#111", uniform_primary: "#1f3a5f", uniform_secondary: "#f4ecd8", uniform_accent: "#f2c14e" },
  hour: Number(q.get("hour") ?? 11), recipe: recipeFor("market")!, arrival: (q.get("mode") as "drive" | "hitch") ?? "drive",
  text, venueName: "Aba Community Market", sound: false, onFrame: f => { (window as any).frame = f; }
});
(window as any).h = h;
const t = q.get("t");
if (t) h.seek(Number(t));
(window as any).done = true;
