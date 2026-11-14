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

/** Low-poly plant: trees get a trunk and a faceted crown; upright plants a cone; the rest a soft mound. */
export function plantObject(p: PlantInstance): THREE.Group {
  const g = new THREE.Group();
  const r = Math.max(0.08, M(p.spreadCm) / 2);
  const h = Math.max(0.08, M(p.heightCm));
  const color = new THREE.Color(p.color);
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const variant = hash(p.species_id) % 3;
  if (p.isTree) {
    const trunkH = h * 0.35;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.1, trunkH, 6), new THREE.MeshLambertMaterial({ color: '#7a5a3a', flatShading: true }));
    trunk.position.y = trunkH / 2;
    const crown = new THREE.Mesh(variant === 1 ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0), mat);
    crown.scale.set(r, (h - trunkH) / 2, r);
    crown.position.y = trunkH + (h - trunkH) / 2;
    g.add(trunk, crown);
  } else if (h > r * 2.2) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, variant === 2 ? 5 : 7), mat);
    cone.position.y = h / 2;
    g.add(cone);
  } else {
    const geo = variant === 0 ? new THREE.IcosahedronGeometry(1, 0) : variant === 1 ? new THREE.DodecahedronGeometry(1, 0) : new THREE.OctahedronGeometry(1, 1);
    const mound = new THREE.Mesh(geo, mat);
    mound.scale.set(r, h / 2, r);
    mound.position.y = h / 2;
    g.add(mound);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  g.position.set(M(p.xCm), 0, M(p.yCm));
  return g;
}

const FIXTURE_COLOR: Partial<Record<Fixture['type'], string>> = {
  lawn: '#8fbf6a',
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
  if (f.polygon && f.polygon.length >= 3) return flat(f.polygon, color, 0.01, `fx-${f.id}`);
  if (f.type === 'tree' || f.type === 'walnut') return null; // neighbours' trees are context, not plants of the plan
  const w = f.w ?? 40;
  const d = f.h ?? 40;
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
      0.012,
      `fx-${f.id}`,
    );
  const box = new THREE.Mesh(new THREE.BoxGeometry(M(w), hgt, M(d)), new THREE.MeshLambertMaterial({ color: f.type === 'fence' ? '#8a6a4a' : color, flatShading: true }));
  box.position.set(M(f.x + w / 2), hgt / 2, M(f.y + d / 2));
  box.name = `fx-${f.id}`;
  box.castShadow = true;
  return box;
}

/** A low fence of posts and a rail along the outline. */
function fenceObject(outline: Pt[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'fence';
  const mat = new THREE.MeshLambertMaterial({ color: '#8a6a4a', flatShading: true });
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % n];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) continue;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(M(len), 0.05, 0.04), mat);
    rail.position.set(M((x1 + x2) / 2), 0.55, M((y1 + y2) / 2));
    rail.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.65, 0.07), mat);
    post.position.set(M(x1), 0.325, M(y1));
    g.add(rail, post);
  }
  return g;
}

export function buildScene(area: Area, instances: PlantInstance[], opts: { fault?: Fault; fence?: boolean } = {}): PlanScene {
  const scene = new THREE.Scene();
  const rest: THREE.Object3D[] = [];
  const outline = areaOutline(area);
  const bed = flat(outline, '#8a6e52', 0, 'bed');
  rest.push(bed);
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
