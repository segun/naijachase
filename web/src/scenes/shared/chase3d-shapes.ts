// Rounded shapes for the 3D scenes, built from code (no model files). A "loft" sweeps a rounded cross-section along a length and lets the
// section change from station to station, which is how a car body is made: a long low nose, a rising windscreen, a roof, a sloping tail,
// with soft corners everywhere and the paint, glass and trim chosen per vertex. Also a rounded box (a box with softened edges), a proper
// tyre, and a soft contact shadow that sits under anything standing on the ground. Lazily loaded with the 3D scenes.
import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateLathe } from "@babylonjs/core/Meshes/Builders/latheBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export type Rgb = readonly [number, number, number];
export const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];

/**
 * One cross-section of a loft, at `z` along its length: it spans y0 (bottom) to y1 (top), is `hw` wide either side of the middle, and
 * `n` says how square it is (2 is an ellipse, 4 a soft rectangle, 8 a nearly sharp one).
 */
export type Station = { z: number; y0: number; y1: number; hw: number; n?: number; /** Shifts the section sideways. */ x?: number };

/** Chooses the colour of one face: where its middle is (x, y, z), and which pair of stations it lies between (the nearer-start one, `station`). */
export type Zone = (x: number, y: number, z: number, station: number, stations: readonly Station[]) => Rgb;

export type LoftOptions = {
  /** Points round each section, spaced evenly along its outline so a colour band keeps a clean edge. */
  ring?: number;
  zone: Zone;
  /** The colour of the two end caps (default: the zone's colour at the middle of the end). */
  cap?: Rgb;
  /** Make the mesh carry the same vertex data as a Babylon box (positions, normals, UVs, no colours) so it can be merged with boxes. */
  plain?: boolean;
};

/** The outline of a station as `ring` points evenly spaced along its length, starting at the middle of one side and going round. */
function outline(s: Station, ring: number): [number, number][] {
  const dense = 240, e = 2 / (s.n ?? 4), cx = s.x ?? 0, cy = (s.y0 + s.y1) / 2, hh = (s.y1 - s.y0) / 2;
  const poly: [number, number][] = [], total = [0];
  for (let k = 0; k <= dense; k++) {
    const t = (k / dense) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
    poly.push([cx + s.hw * Math.sign(c) * Math.abs(c) ** e, cy + hh * Math.sign(sn) * Math.abs(sn) ** e]);
    if (k) total.push(total[k - 1]! + Math.hypot(poly[k]![0] - poly[k - 1]![0], poly[k]![1] - poly[k - 1]![1]));
  }
  const length = total[dense]!, out: [number, number][] = [];
  let k = 0;
  for (let j = 0; j < ring; j++) {
    const want = (j / ring) * length;
    while (k < dense - 1 && total[k + 1]! < want) k++;
    const span = total[k + 1]! - total[k]! || 1, f = (want - total[k]!) / span;
    out.push([poly[k]![0] + (poly[k + 1]![0] - poly[k]![0]) * f, poly[k]![1] + (poly[k + 1]![1] - poly[k]![1]) * f]);
  }
  return out;
}

/**
 * Sweeps the stations, ordered by increasing z, into a closed smooth-shaded mesh with a flat colour per face. Material: any StandardMaterial with
 * a white diffuse colour (the vertex colours supply the paint). The first and last station are closed with a flat cap.
 */
export function loft(scene: Scene, name: string, stations: readonly Station[], options: LoftOptions): Mesh {
  const ring = options.ring ?? 48;
  const count = stations.length;
  const positions: number[] = [], colours: number[] = [], indices: number[] = [], normals: number[] = [];
  const wrap = (j: number) => (j + ring) % ring;
  const grid: [number, number, number][][] = stations.map(s => outline(s, ring).map(([x, y]): [number, number, number] => [x, y, s.z]));
  const norm: [number, number, number][][] = grid.map((row, i) => row.map((p, j) => {
    // The normal is the cross product of the two directions the surface runs in, so it follows the shape however the sections change.
    const a = row[wrap(j + 1)]!, b = row[wrap(j - 1)]!, c = grid[Math.min(count - 1, i + 1)]![j]!, d = grid[Math.max(0, i - 1)]![j]!;
    const tr: [number, number, number] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], tz: [number, number, number] = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    let n: [number, number, number] = [tr[1] * tz[2] - tr[2] * tz[1], tr[2] * tz[0] - tr[0] * tz[2], tr[0] * tz[1] - tr[1] * tz[0]];
    const st = stations[i]!;
    if (n[0] * (p[0] - (st.x ?? 0)) + n[1] * (p[1] - (st.y0 + st.y1) / 2) < 0) n = [-n[0], -n[1], -n[2]];
    const l = Math.hypot(...n) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  }));

  for (let i = 0; i < count - 1; i++) {
    for (let j = 0; j < ring; j++) {
      const ids = [[i, j], [i, wrap(j + 1)], [i + 1, j], [i + 1, wrap(j + 1)]] as const;
      const pts = ids.map(([r, c]) => grid[r]![c]!);
      const mx = (pts[0]![0] + pts[1]![0] + pts[2]![0] + pts[3]![0]) / 4, my = (pts[0]![1] + pts[1]![1] + pts[2]![1] + pts[3]![1]) / 4, mz = (pts[0]![2] + pts[2]![2]) / 2;
      const colour = options.zone(mx, my, mz, i, stations);
      const base = positions.length / 3;
      ids.forEach(([r, c], k) => { positions.push(...pts[k]!); normals.push(...norm[r]![c]!); colours.push(...colour, 1); });
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  // The caps: a fan to the middle of the first and last station, with flat normals.
  const cap = (i: number, dir: 1 | -1) => {
    const s = stations[i]!, cy = (s.y0 + s.y1) / 2, colour = options.cap ?? options.zone(s.x ?? 0, cy, s.z, i, stations);
    const centre = positions.length / 3;
    positions.push(s.x ?? 0, cy, s.z); normals.push(0, 0, dir); colours.push(...colour, 1);
    const first = positions.length / 3;
    for (let j = 0; j < ring; j++) { positions.push(...grid[i]![j]!); normals.push(0, 0, dir); colours.push(...colour, 1); }
    for (let j = 0; j < ring; j++) { const a = first + j, b = first + wrap(j + 1); if (dir === -1) indices.push(centre, a, b); else indices.push(centre, b, a); }
  };
  cap(0, -1); cap(count - 1, 1);

  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions; data.indices = indices; data.normals = normals;
  if (options.plain) data.uvs = new Array((positions.length / 3) * 2).fill(0); else data.colors = colours;
  data.applyToMesh(mesh);
  return mesh;
}

/** A box with softened edges: `r` is how far the corners are rounded (it never exceeds a third of the smallest side). */
export function roundedBox(scene: Scene, name: string, w: number, h: number, d: number, r: number, plain = false): Mesh {
  const k = Math.min(r, Math.min(w, h, d) / 3);
  const hw = w / 2, hh = h / 2, hd = d / 2;
  // Squarish sections at the middle, shrunk towards the ends so the end faces are rounded off too.
  const stations: Station[] = [
    { z: -hd, y0: -hh + k, y1: hh - k, hw: hw - k, n: 8 },
    { z: -hd + k * 0.35, y0: -hh + k * 0.35, y1: hh - k * 0.35, hw: hw - k * 0.35, n: 8 },
    { z: -hd + k, y0: -hh, y1: hh, hw, n: 8 },
    { z: hd - k, y0: -hh, y1: hh, hw, n: 8 },
    { z: hd - k * 0.35, y0: -hh + k * 0.35, y1: hh - k * 0.35, hw: hw - k * 0.35, n: 8 },
    { z: hd, y0: -hh + k, y1: hh - k, hw: hw - k, n: 8 }
  ];
  return loft(scene, name, stations, { ring: plain ? 28 : 20, zone: () => [1, 1, 1], plain });
}

/** A tyre with a rounded sidewall, built by spinning a profile; its axle runs along x. `radius` is the outer radius, `width` the tread width. */
export function tyre(scene: Scene, name: string, radius: number, width: number): Mesh {
  const rim = radius * 0.58, w = width / 2, bulge = w * 1.08;
  const profile = [
    new Vector3(rim, -w * 0.82, 0), new Vector3(rim + (radius - rim) * 0.3, -bulge, 0), new Vector3(radius - (radius - rim) * 0.12, -w * 0.9, 0),
    new Vector3(radius, -w * 0.5, 0), new Vector3(radius, w * 0.5, 0), new Vector3(radius - (radius - rim) * 0.12, w * 0.9, 0),
    new Vector3(rim + (radius - rim) * 0.3, bulge, 0), new Vector3(rim, w * 0.82, 0), new Vector3(rim * 0.9, w * 0.6, 0), new Vector3(rim * 0.9, -w * 0.6, 0)
  ];
  const mesh = CreateLathe(name, { shape: profile, tessellation: 28, closed: true }, scene);
  mesh.rotation.z = Math.PI / 2;
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

const blobs = new WeakMap<Scene, StandardMaterial>();
const blobMaterial = (scene: Scene): StandardMaterial => {
  let m = blobs.get(scene);
  if (!m) {
    const tex = new DynamicTexture("blob", { width: 64, height: 64 }, scene, false);
    const g = tex.getContext();
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,.62)"); grad.addColorStop(0.55, "rgba(0,0,0,.3)"); grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    tex.update(); tex.hasAlpha = true;
    m = new StandardMaterial("blobMat", scene);
    m.diffuseTexture = tex; m.useAlphaFromDiffuseTexture = true; m.disableLighting = true; m.emissiveColor = new Color3(0, 0, 0);
    m.specularColor = new Color3(0, 0, 0); m.backFaceCulling = false; m.zOffset = -2;
    blobs.set(scene, m);
  }
  return m;
};

/** A soft dark patch on the ground under something that stands there, `width` by `depth` metres, centred on its parent's feet. It grounds the object. */
export function contactShadow(scene: Scene, parent: TransformNode | null, width: number, depth: number, x = 0, z = 0): Mesh {
  const plane = CreatePlane("contact", { width, height: depth }, scene);
  plane.rotation.x = Math.PI / 2;
  plane.position.set(x, 0.025, z);
  plane.material = blobMaterial(scene);
  plane.isPickable = false; plane.receiveShadows = false;
  if (parent) plane.parent = parent;
  return plane;
}
