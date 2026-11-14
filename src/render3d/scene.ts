// Deterministic 3D scene of a plan (spec v0.2 F1), built with three.js from the plan's own data: the area outline,
// its elements and one object per plant. Plan coordinates are cm from the top-left corner; the scene uses metres,
// x along the width and z along the length, y up. The same input always gives the same scene.
import * as THREE from 'three';
import type { Area, Fixture, Pt } from '../model/types';
import { areaOutline, type PlantInstance } from './instances';

/** Deliberate faults, only for the negative tests of the verification (they must make it FAIL). */
export type Fault = { kind: 'offset'; index: number; dxCm: number } | { kind: 'drop'; index: number } | { kind: 'species'; index: number; species: string };

export interface PlanScene {
  scene: THREE.Scene;
  /** One object per plant, in plan order (render_object_id = object name). */
  plants: THREE.Object3D[];
  /** Everything that is not a plant (ground, elements, fence, dimension lines). */
  rest: THREE.Object3D[];
  /** Bounding box of the area in metres: [minX, minZ, maxX, maxZ]. */
  bounds: [number, number, number, number];
}

const M = (cm: number) => cm / 100;
/** Thickness of the bed slab: plants and elements stand on top of it. */
export const SLAB = 0.06;

/** A small deterministic hash of a species code: picks its shape variant. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function shapeOf(ptsCm: Pt[]): THREE.Shape {
  // Shape lies in the x/y plane; it is turned into the ground (x/z) plane by rotating −90° about x, which maps
  // shape y to −z, so y is negated here to keep plan y = scene z.
  const s = new THREE.Shape();
  ptsCm.forEach(([x, y], i) => (i ? s.lineTo(M(x), -M(y)) : s.moveTo(M(x), -M(y))));
  s.closePath();
  return s;
}

function flat(ptsCm: Pt[], color: string, y: number, name: string): THREE.Mesh {
  const g = new THREE.ShapeGeometry(shapeOf(ptsCm), 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  m.position.y = y;
  m.name = name;
  m.receiveShadow = true;
  return m;
}

/** Deterministic small colour shift per plant (hue ±, lightness ±), so a drift does not look like one plastic block. */
function jitter(base: THREE.Color, key: string, amount = 0.05): THREE.Color {
  const h = hash(key);
  const c = base.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(
    (hsl.h + (((h % 100) / 100 - 0.5) * amount) / 2 + 1) % 1,
    Math.min(1, hsl.s * 0.9 + 0.05),
    Math.min(0.85, Math.max(0.12, hsl.l + (((h >> 8) % 100) / 100 - 0.5) * amount)),
  );
}

const mat = (c: THREE.Color | string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const FOLIAGE = new THREE.Color('#4f7a3a');

/**
 * Clump of low-poly blobs: one in the middle and four around it on the ±x and ±z axes. The layout is symmetric, so
 * the clump's bounding-box centre is exactly the plant position (the verification measures that centre).
 */
function clump(r: number, h: number, y0: number, color: THREE.Color, detail: 0 | 1, top?: THREE.Color): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), mat(color));
  core.scale.set(r * 0.72, h * 0.55, r * 0.72);
  core.position.y = y0 + h * 0.5;
  out.push(core);
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), mat(top ?? color));
    b.scale.set(r * 0.45, h * 0.38, r * 0.45);
    b.position.set(dx * r * 0.52, y0 + h * 0.4, dz * r * 0.52);
    out.push(b);
  }
  return out;
}

/** Tree crowns are leaves first: the species colour (often its blossom) is mixed with green. */
const leafy = (c: THREE.Color, key: string) => jitter(c.clone().lerp(FOLIAGE, 0.45), key, 0.06);

/**
 * Low-poly plant in the style of the reference: clumped round crowns on trunks, slim conifer columns, grass tufts,
 * perennial mounds with flower spikes or caps in the species colour, low cushions. Size from the species (mature
 * height and spread), colour from the species; every model is symmetric about the plant position.
 */
export function plantObject(p: PlantInstance): THREE.Group {
  const g = new THREE.Group();
  const r = Math.max(0.08, M(p.spreadCm) / 2);
  const h = Math.max(0.08, M(p.heightCm));
  const color = jitter(new THREE.Color(p.color), p.plant_id);
  const leaves = jitter(FOLIAGE, p.plant_id + 'f', 0.08);
  const add = (...ms: THREE.Mesh[]) => g.add(...ms);
  switch (p.form) {
    case 'tree': {
      const trunkH = h * 0.36;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.04, r * 0.07), Math.max(0.05, r * 0.1), trunkH, 6), mat('#6b4e34'));
      trunk.position.y = trunkH / 2;
      const crown = leafy(color, p.plant_id);
      add(trunk, ...clump(r, h - trunkH, trunkH * 0.9, crown, 1, crown.clone().offsetHSL(0, 0, 0.05)));
      break;
    }
    case 'conifer':
    case 'columnar': {
      const dark = jitter(new THREE.Color('#2f5d3a'), p.plant_id, 0.06);
      const n = p.form === 'columnar' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const ri = r * (1 - i * (0.6 / n));
        const hi = (h / n) * 1.6;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(ri, hi, 8), mat(dark.clone().offsetHSL(0, 0, 0.025 * i)));
        cone.position.y = Math.min(h - hi / 2, (h / n) * i * 0.9 + hi / 2);
        add(cone);
      }
      break;
    }
    case 'grass': {
      // A fountain: narrow at the base, opening upwards, the airy top in a straw tint of the species colour.
      const blades = jitter(new THREE.Color('#7f8f4f'), p.plant_id, 0.06);
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.3, h * 0.8, 8, 1), mat(blades));
      vase.position.y = h * 0.4;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.9, h * 0.2, 8, 1), mat(color.clone().lerp(new THREE.Color('#d9cf9f'), 0.55)));
      top.position.y = h * 0.9;
      add(vase, top);
      break;
    }
    case 'spike': {
      // Foliage at the base, flower spikes in the species colour above it.
      add(...clump(r * 0.85, h * 0.45, 0, leaves, 0));
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, h * 0.7, 6), mat(color));
      spike.position.y = h * 0.65;
      add(spike);
      break;
    }
    case 'cushion':
      add(...clump(r, Math.max(0.06, h), 0, color.clone().lerp(leaves, 0.25), 0));
      break;
    case 'shrub':
      add(...clump(r, h, 0, leafy(color, p.plant_id), 1));
      break;
    default:
      // Perennial: green mound with a cap of flowers in the species colour.
      add(...clump(r, h, 0, leaves, 1, color));
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  g.position.set(M(p.xCm), SLAB, M(p.yCm));
  return g;
}

const FIXTURE_COLOR: Partial<Record<Fixture['type'], string>> = {
  lawn: '#7cb352',
  paving: '#c9c2b4',
  path: '#d2c4a8',
  gravel: '#ddd5c4',
  pond: '#7fb6d1',
  wall: '#a7a29a',
  shed: '#9c7d5b',
  bench: '#b8875a',
  raisedBed: '#7b5b3d',
  well: '#9aa3a8',
  compost: '#6e5238',
  rainBarrel: '#5f88a0',
};
const FIXTURE_HEIGHT: Partial<Record<Fixture['type'], number>> = { wall: 1.2, shed: 2.2, bench: 0.45, raisedBed: 0.35, well: 0.6, compost: 0.9, rainBarrel: 0.9, fence: 1 };

function fixtureObject(f: Fixture): THREE.Object3D | null {
  const color = FIXTURE_COLOR[f.type] ?? '#b9b2a4';
  if (f.polygon && f.polygon.length >= 3) return flat(f.polygon, color, SLAB + 0.004, `fx-${f.id}`);
  if (f.type === 'tree' || f.type === 'walnut') return null; // neighbours' trees are context, not plants of the plan
  const w = f.w ?? 40;
  const d = f.h ?? 40;
  if (f.type === 'fence') {
    // A fence element: the same light fence along its long axis.
    const line: Pt[] =
      w >= d
        ? [
            [f.x, f.y + d / 2],
            [f.x + w, f.y + d / 2],
          ]
        : [
            [f.x + w / 2, f.y],
            [f.x + w / 2, f.y + d],
          ];
    const g = fenceObject(line, false);
    g.name = `fx-${f.id}`;
    return g;
  }
  const hgt = FIXTURE_HEIGHT[f.type];
  if (hgt == null)
    return flat(
      [
        [f.x, f.y],
        [f.x + w, f.y],
        [f.x + w, f.y + d],
        [f.x, f.y + d],
      ],
      color,
      SLAB + 0.006,
      `fx-${f.id}`,
    );
  const box = new THREE.Mesh(new THREE.BoxGeometry(M(w), hgt, M(d)), new THREE.MeshLambertMaterial({ color, flatShading: true }));
  box.position.set(M(f.x + w / 2), SLAB + hgt / 2, M(f.y + d / 2));
  box.name = `fx-${f.id}`;
  box.castShadow = true;
  return box;
}

/** A light, low fence along the outline: two thin rails and a post about every 1.5 m (and at every corner). */
function fenceObject(outline: Pt[], closed = true): THREE.Group {
  const g = new THREE.Group();
  g.name = 'fence';
  const wood = mat('#7d6248');
  const n = outline.length;
  let sinceLast = Infinity;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % n];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) continue;
    for (const y of [0.18, 0.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(M(len), 0.03, 0.025), wood);
      rail.position.set(M((x1 + x2) / 2), SLAB + y, M((y1 + y2) / 2));
      rail.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
      g.add(rail);
    }
    // Posts: at a sharp corner always, along a curve only every ~150 cm.
    const prev = outline[(i - 1 + n) % n];
    const turn = Math.abs(Math.atan2(y2 - y1, x2 - x1) - Math.atan2(y1 - prev[1], x1 - prev[0])) % (2 * Math.PI);
    if (sinceLast >= 150 || (turn > 0.5 && turn < 2 * Math.PI - 0.5)) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), wood);
      post.position.set(M(x1), SLAB + 0.25, M(y1));
      g.add(post);
      sinceLast = 0;
    }
    sinceLast += len;
  }
  if (!closed && n > 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), wood);
    post.position.set(M(outline[n - 1][0]), SLAB + 0.25, M(outline[n - 1][1]));
    g.add(post);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

/** The bed as a thin slab (like a site model) and a pale ground around it that catches the shadows. */
function groundObjects(outline: Pt[], bounds: [number, number, number, number]): THREE.Object3D[] {
  const slab = new THREE.ExtrudeGeometry(shapeOf(outline), { depth: SLAB, bevelEnabled: false });
  slab.rotateX(-Math.PI / 2);
  const bed = new THREE.Mesh(slab, mat('#6f5440'));
  bed.name = 'bed';
  bed.receiveShadow = true;
  const [x0, z0, x1, z1] = bounds;
  const span = Math.max(x1 - x0, z1 - z0);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(span * 6, span * 6), new THREE.ShadowMaterial({ opacity: 0.16 }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.set((x0 + x1) / 2, -0.001, (z0 + z1) / 2);
  plane.receiveShadow = true;
  plane.name = 'ground';
  return [plane, bed];
}

export function buildScene(area: Area, instances: PlantInstance[], opts: { fault?: Fault; fence?: boolean } = {}): PlanScene {
  const scene = new THREE.Scene();
  const rest: THREE.Object3D[] = [];
  const outline = areaOutline(area);
  const xs0 = outline.map((q) => M(q[0]));
  const zs0 = outline.map((q) => M(q[1]));
  rest.push(...groundObjects(outline, [Math.min(...xs0), Math.min(...zs0), Math.max(...xs0), Math.max(...zs0)]));
  for (const f of area.fixtures) {
    const o = fixtureObject(f);
    if (o) rest.push(o);
  }
  if (opts.fence !== false) rest.push(fenceObject(outline));

  const plants: THREE.Object3D[] = [];
  instances.forEach((p, i) => {
    const fault = opts.fault && opts.fault.index === i ? opts.fault : undefined;
    if (fault?.kind === 'drop') return;
    const o = plantObject(p);
    if (fault?.kind === 'offset') o.position.x += M(fault.dxCm);
    o.name = `obj-${p.plant_id}`;
    o.userData = { kind: 'plant', plant_id: p.plant_id, species_id: fault?.kind === 'species' ? fault.species : p.species_id, species_name: p.species_name };
    plants.push(o);
  });
  for (const o of [...rest, ...plants]) scene.add(o);
  const xs = outline.map((q) => M(q[0]));
  const zs = outline.map((q) => M(q[1]));
  return { scene, plants, rest, bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] };
}

/**
 * The real centre of each plant object, measured in the scene graph (world bounding box of its meshes, on the
 * ground plane) – not a copy of the input position.
 */
export function measuredCentre(o: THREE.Object3D): [number, number] {
  o.updateWorldMatrix(true, true);
  const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  return [c.x, c.z];
}
