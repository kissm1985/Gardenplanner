// Browser side of the 3D render (spec v0.2 F1): an isometric view of the scene with WebGL, and an ID-buffer pass
// (every plant in its own flat colour, no lighting, no smoothing) to count the pixels each plant really shows.
import * as THREE from 'three';
import type { Area, Plant } from '../model/types';
import { areaOutline, plantInstances, type PlantInstance } from './instances';
import { t } from '../i18n';
import { localName } from '../i18n/names';
import { buildScene, type Fault, type PlanScene } from './scene';
import { dimensionLines } from './decor';
import { buildManifest, type Manifest, type Visibility } from './verify';

export interface RenderResult {
  instances: PlantInstance[];
  manifest: Manifest;
  /** PNG of the final render (data URL). */
  png: string;
  /** PNG of the ID buffer (data URL), as evidence. */
  idPng: string;
  /** Visible pixels per plant_id in the ID buffer, and their share of the image. */
  visibility: Record<string, Visibility>;
  /** Pixels in the ID buffer whose colour is no plant and not the background (should be 0). */
  strayPixels: number;
  width: number;
  height: number;
  /** The viewing direction chosen (degrees). */
  azimuth: number;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  fault?: Fault;
  project?: string;
  /** Fixed viewing direction (degrees); default: the diagonal where the plants show best. */
  azimuth?: number;
  /** Title in the title block (default: the area name). */
  title?: string;
}

/** Aerial (axonometric) orthographic camera from the given azimuth (degrees), framing the whole area and the tallest plant. */
function isoCamera(ps: PlanScene, aspect: number, maxH: number, azimuth = 45, elevation = 38): THREE.OrthographicCamera {
  const [x0, z0, x1, z1] = ps.bounds;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const box = new THREE.Box3(new THREE.Vector3(x0 - 0.6, 0, z0 - 0.6), new THREE.Vector3(x1 + 0.6, Math.max(1, maxH), z1 + 0.6));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const d = 100;
  cam.position.set(cx + dir.x * d, dir.y * d, cz + dir.z * d);
  cam.lookAt(cx, 0, cz);
  cam.updateMatrixWorld();
  // Fit: project the box corners into camera space and size the frustum around them.
  const inv = cam.matrixWorldInverse;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      }
  let w = maxX - minX;
  let h = maxY - minY;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  const pad = 1.06;
  cam.left = mx - (w / 2) * pad;
  cam.right = mx + (w / 2) * pad;
  cam.top = my + (h / 2) * pad;
  cam.bottom = my - (h / 2) * pad;
  cam.updateProjectionMatrix();
  return cam;
}

/** Soft daylight: sky light plus a low sun from the viewer's left, so the shadows fall long and to the right. */
function lights(scene: THREE.Scene, ps: PlanScene, azimuth: number) {
  const [x0, z0, x1, z1] = ps.bounds;
  const span = Math.max(x1 - x0, z1 - z0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9bea6', 1.9));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.1);
  const a = ((azimuth + 75) * Math.PI) / 180;
  sun.position.set((x0 + x1) / 2 + Math.sin(a) * span, span * 0.9, (z0 + z1) / 2 + Math.cos(a) * span);
  sun.target.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  const s = sun.shadow.camera;
  s.left = -span;
  s.right = span;
  s.top = span;
  s.bottom = -span;
  s.far = span * 4;
  sun.shadow.radius = 6;
  scene.add(sun, sun.target);
}

/** ID-buffer pass: plant i in colour i+1, everything else black (it still hides what is behind it). */
function idPass(renderer: THREE.WebGLRenderer, ps: PlanScene, cam: THREE.Camera, width: number, height: number, full = true) {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, depthBuffer: true });
  const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const hidden: THREE.Object3D[] = [];
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  ps.scene.traverse((o) => {
    if ((o as THREE.Light).isLight || o instanceof THREE.Sprite || o instanceof THREE.Line) {
      if (o.visible) hidden.push(o);
    }
  });
  hidden.forEach((o) => (o.visible = false));
  for (const o of ps.rest)
    o.traverse((m) => {
      if (m instanceof THREE.Mesh) {
        saved.set(m, m.material);
        m.material = black;
      }
    });
  ps.plants.forEach((o, i) => {
    const id = i + 1;
    const mat = new THREE.MeshBasicMaterial();
    mat.color.setRGB(((id >> 16) & 255) / 255, ((id >> 8) & 255) / 255, (id & 255) / 255, THREE.LinearSRGBColorSpace);
    o.traverse((m) => {
      if (m instanceof THREE.Mesh) {
        saved.set(m, m.material);
        m.material = mat;
      }
    });
  });
  const bg = ps.scene.background;
  ps.scene.background = new THREE.Color(0, 0, 0);
  const shadows = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(ps.scene, cam);
  const buf = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, buf);

  // Each plant alone (nothing in front of it): the pixels it would show unhidden. Rendered only inside its projected
  // rectangle (scissor), so this stays fast even with hundreds of plants.
  const alone = new Map<number, number>();
  const shown = full ? [...ps.rest, ...ps.plants].filter((o) => o.visible) : [];
  shown.forEach((o) => (o.visible = false));
  (full ? ps.plants : []).forEach((o, i) => {
    const r = screenRect(o, cam, width, height);
    if (!r) return alone.set(i + 1, 0);
    o.visible = true;
    target.scissor.set(r.x, r.y, r.w, r.h);
    target.scissorTest = true;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(ps.scene, cam);
    const part = new Uint8Array(r.w * r.h * 4);
    renderer.readRenderTargetPixels(target, r.x, r.y, r.w, r.h, part);
    let n = 0;
    for (let k = 0; k < part.length; k += 4) if (((part[k] << 16) | (part[k + 1] << 8) | part[k + 2]) === i + 1) n++;
    alone.set(i + 1, n);
    o.visible = false;
  });
  target.scissorTest = false;
  shown.forEach((o) => (o.visible = true));
  renderer.setRenderTarget(null);
  renderer.shadowMap.enabled = shadows;
  ps.scene.background = bg;
  saved.forEach((m, mesh) => (mesh.material = m));
  hidden.forEach((o) => (o.visible = true));
  target.dispose();

  const counts = new Map<number, number>();
  let stray = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const id = (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2];
    if (!id) continue;
    if (id > ps.plants.length) stray++;
    else counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  // Evidence image: the ID buffer with each plant in a well-separated hue (flipped: render targets are bottom-up).
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const s = ((height - 1 - y) * width + x) * 4;
      const d = (y * width + x) * 4;
      const id = (buf[s] << 16) | (buf[s + 1] << 8) | buf[s + 2];
      if (id) {
        const hue = (id * 137.508) % 360;
        const col = new THREE.Color().setHSL(hue / 360, 0.75, 0.55);
        img.data[d] = col.r * 255;
        img.data[d + 1] = col.g * 255;
        img.data[d + 2] = col.b * 255;
      }
      img.data[d + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return { counts, alone, stray, idPng: c.toDataURL('image/png') };
}

/** The object's projected bounding rectangle in render-target pixels (origin bottom-left), clamped; null if off screen. */
function screenRect(o: THREE.Object3D, cam: THREE.Camera, width: number, height: number): { x: number; y: number; w: number; h: number } | null {
  const b = new THREE.Box3().setFromObject(o);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const x of [b.min.x, b.max.x])
    for (const y of [b.min.y, b.max.y])
      for (const z of [b.min.z, b.max.z]) {
        const v = new THREE.Vector3(x, y, z).project(cam);
        const px = ((v.x + 1) / 2) * width;
        const py = ((v.y + 1) / 2) * height;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
  const x = Math.max(0, Math.floor(x0) - 2);
  const y = Math.max(0, Math.floor(y0) - 2);
  const w = Math.min(width, Math.ceil(x1) + 2) - x;
  const h = Math.min(height, Math.ceil(y1) + 2) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** The four diagonal views; the one where the plants show the most (fewest hidden behind walls or each other) wins. */
const AZIMUTHS = [45, 135, 225, 315];

export function renderPlan(area: Area, plantDb: Plant[], items = area.variants.find((v) => v.id === area.chosenVariantId)?.items ?? [], opts: RenderOptions = {}): RenderResult {
  const width = opts.width ?? 2400;
  const height = opts.height ?? 1700;
  const instances = plantInstances(items, plantDb);
  const ps = buildScene(area, instances, { fault: opts.fault });
  for (const o of dimensionLines(area)) {
    ps.scene.add(o);
    ps.rest.push(o);
  }
  ps.scene.background = new THREE.Color('#ffffff');
  const maxH = Math.max(1, ...instances.map((p) => p.heightCm / 100));

  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Viewpoint: deterministic choice among the four diagonals, by the plant pixels a small ID buffer shows.
  let azimuth = opts.azimuth ?? AZIMUTHS[0];
  if (opts.azimuth == null) {
    let best = -1;
    for (const az of AZIMUTHS) {
      const probe = idPass(renderer, ps, isoCamera(ps, width / height, maxH, az), 480, Math.round((480 * height) / width), false);
      const shown = [...probe.counts.values()].reduce((x, y) => x + y, 0);
      if (shown > best) {
        best = shown;
        azimuth = az;
      }
    }
  }
  const cam = isoCamera(ps, width / height, maxH, azimuth);
  lights(ps.scene, ps, azimuth);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.render(ps.scene, cam);
  const png = withTitleBlock(canvas, area, instances, opts.title);

  const { counts, alone, stray, idPng } = idPass(renderer, ps, cam, width, height);
  const total = width * height;
  const visibility: Record<string, Visibility> = {};
  ps.plants.forEach((o, i) => {
    const n = counts.get(i + 1) ?? 0;
    visibility[o.userData.plant_id as string] = { pixels: n, share: n / total, potentialShare: (alone.get(i + 1) ?? 0) / total };
  });
  renderer.dispose();
  const manifest = buildManifest(opts.project ?? area.id, area.name, instances, ps.plants);
  return { instances, manifest, png, idPng, visibility, strayPixels: stray, width, height, azimuth };
}

/** The render with a title block in a band below it (the band never covers the drawing). */
function withTitleBlock(gl: HTMLCanvasElement, area: Area, instances: PlantInstance[], title?: string): string {
  const w = gl.width;
  const band = Math.round(w * 0.065);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = gl.height + band;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(gl, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, gl.height, w, band);
  ctx.fillStyle = '#244b3c';
  ctx.fillRect(0, gl.height, w, Math.max(3, band * 0.05));
  const pad = band * 0.32;
  const species = new Set(instances.map((p) => p.species_id)).size;
  const outline = areaOutline(area);
  const xs = outline.map((q) => q[0]);
  const ys = outline.map((q) => q[1]);
  const size = `${((Math.max(...xs) - Math.min(...xs)) / 100).toFixed(2).replace('.', ',')} × ${((Math.max(...ys) - Math.min(...ys)) / 100).toFixed(2).replace('.', ',')} m`;
  ctx.textBaseline = 'middle';
  const y1 = gl.height + band * 0.42;
  const y2 = gl.height + band * 0.74;
  ctx.fillStyle = '#1f2a22';
  ctx.font = `600 ${Math.round(band * 0.3)}px sans-serif`;
  ctx.fillText(localName(title ?? area.name), pad, y1);
  ctx.fillStyle = '#5b6359';
  ctx.font = `${Math.round(band * 0.19)}px sans-serif`;
  ctx.fillText(t(`Látványterv · ${instances.length} növény · ${species} faj · ${size}`, `Visualisation · ${instances.length} plants · ${species} species · ${size}`), pad, y2);
  ctx.textAlign = 'right';
  ctx.fillText(t('A terv adataiból számítva, nem fotó', 'Computed from the plan data, not a photo'), w - pad, y2);
  ctx.fillStyle = '#244b3c';
  ctx.font = `600 ${Math.round(band * 0.24)}px sans-serif`;
  ctx.fillText(`Planterra · ${new Date().toISOString().slice(0, 10)}`, w - pad, y1);
  return c.toDataURL('image/png');
}
