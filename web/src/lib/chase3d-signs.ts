// Roadside signboards that name each city inside the 3D scene: a hospital sign for Lagos, the market gate sign for
// Onitsha in Anambra, and a welcome board for Sabon Gari in Kano. The text is painted onto textures at load time.
import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import { material, paint } from "./chase3d-kit.ts";

export type SignKind = "lagos" | "anambra" | "kano";

const W = 1024, H = 428;
const BOLD = "bold {px}px 'Arial Black', Impact, 'Helvetica Neue', Arial, sans-serif";

/** Draws one line centred on `cx`, shrinking the type until it fits `maxWidth`. */
function line(g: ICanvasRenderingContext, text: string, cx: number, baseline: number, size: number, maxWidth: number, color: string) {
  let px = size;
  g.font = BOLD.replace("{px}", String(px));
  while (px > 18 && g.measureText(text).width > maxWidth) { px -= 4; g.font = BOLD.replace("{px}", String(px)); }
  g.fillStyle = color;
  g.fillText(text, cx - g.measureText(text).width / 2, baseline);
}

const painters: Record<SignKind, (g: ICanvasRenderingContext) => void> = {
  lagos(g) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1457b8"); sky.addColorStop(1, "#08306f");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14); g.fillRect(0, 0, 14, H); g.fillRect(W - 14, 0, 14, H);
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(160, 196, 112, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#d62828"; g.fillRect(118, 150, 84, 92); g.fillRect(100, 168, 120, 56);
    line(g, "LAGOS ISLAND", 622, 190, 120, 650, "#ffffff");
    line(g, "MEDICAL HOSPITAL", 622, 290, 84, 650, "#bfe6ff");
    g.fillStyle = "#ffd23f"; g.fillRect(310, 330, 624, 6);
    line(g, "EMERGENCY  \u2022  OPEN 24 HOURS", 622, 392, 44, 620, "#ffd23f");
  },
  anambra(g) {
    g.fillStyle = "#f6c40f"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#c8281f"; g.fillRect(0, 0, W, 58);
    g.fillStyle = "#1f7a3a"; g.fillRect(0, H - 58, W, 58);
    g.fillStyle = "#ffffff";
    for (let x = 18; x < W; x += 48) { g.fillRect(x, 20, 20, 18); g.fillRect(x + 24, H - 40, 20, 18); }
    line(g, "ONITSHA", W / 2, 212, 168, 900, "#14110d");
    line(g, "MAIN MARKET", W / 2, 322, 112, 900, "#c8281f");
    g.fillStyle = "#14110d"; g.fillRect(150, 338, 724, 5);
  },
  kano(g) {
    g.fillStyle = "#efdfb8"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#b4562f";
    for (let x = 0; x < W; x += 64) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 50); g.lineTo(x + 64, 0); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x, H); g.lineTo(x + 32, H - 50); g.lineTo(x + 64, H); g.closePath(); g.fill();
    }
    g.fillStyle = "#6b3a1f"; g.fillRect(0, 56, W, 6); g.fillRect(0, H - 62, W, 6);
    line(g, "WELCOME TO", W / 2, 158, 88, 880, "#5a3820");
    line(g, "SABON GARI", W / 2, 300, 168, 900, "#1d5a33");
    line(g, "KANO", W / 2, 360, 40, 400, "#b4562f");
  }
};

/** Builds a sign on two posts. Returns the root node (not instanced: each board has its own texture). */
export function buildSign(scene: Scene, kind: SignKind, size: { width: number; height: number; bottom: number }): TransformNode {
  const root = new TransformNode(`sign-${kind}`, scene);
  const { width, height, bottom } = size;
  const texture = paint(scene, `signTex-${kind}`, W, H, painters[kind]);
  texture.anisotropicFilteringLevel = 4;

  const face = new StandardMaterial(`signFace-${kind}`, scene);
  face.disableLighting = true;
  face.emissiveTexture = texture;
  face.backFaceCulling = false;
  const plane = CreatePlane(`signFace-${kind}`, { width, height }, scene);
  plane.parent = root; plane.position.set(0, bottom + height / 2, -0.14); plane.material = face;

  const frameMat = material(scene, `signFrame-${kind}`, kind === "kano" ? "#5a3820" : "#1b2430", { specular: 0.1 });
  const board = CreateBox(`signBoard-${kind}`, { width: width + 0.2, height: height + 0.2, depth: 0.22 }, scene);
  board.parent = root; board.position.set(0, bottom + height / 2, 0); board.material = frameMat;
  for (const side of [-1, 1]) {
    const post = CreateCylinder(`signPost-${kind}${side}`, { height: bottom + 0.2, diameter: 0.22, tessellation: 8 }, scene);
    post.parent = root; post.position.set(side * width * 0.36, (bottom + 0.2) / 2, 0.05); post.material = frameMat;
  }
  if (kind !== "kano") { // a row of floodlights along the top so the board reads at night and dusk
    const lamp = material(scene, `signLamp-${kind}`, "#fff3c4", { emissive: "#fff3c4" });
    for (let i = 0; i < 6; i++) {
      const bulb = CreateSphere(`signBulb-${kind}${i}`, { diameter: 0.28, segments: 6 }, scene);
      bulb.parent = root; bulb.position.set(-width / 2 + (width / 5) * i, bottom + height + 0.32, -0.25); bulb.material = lamp;
    }
  }
  return root;
}
