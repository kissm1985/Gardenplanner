// Dimension lines of the 3D render: the width along the top edge and the length along the left edge of the area's
// bounding box, with end ticks and a label in metres. For a free outline they measure its extent.
import * as THREE from 'three';
import type { Area } from '../model/types';
import { areaOutline } from './instances';

const M = (cm: number) => cm / 100;
const fmt = (cm: number) => `${(cm / 100).toFixed(2).replace('.', ',')} m`;

function label(text: string, heightM: number): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const px = 64;
  ctx.font = `600 ${px}px sans-serif`;
  c.width = Math.ceil(ctx.measureText(text).width) + 24;
  c.height = px + 24;
  ctx.font = `600 ${px}px sans-serif`;
  ctx.fillStyle = 'rgba(244,241,234,0.9)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#2b3a30';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set((heightM * c.width) / c.height, heightM, 1);
  s.renderOrder = 10;
  s.name = 'dim-label';
  return s;
}

function line(points: THREE.Vector3[]): THREE.Line {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#2b3a30', depthTest: false }));
  l.name = 'dim-line';
  l.renderOrder = 9;
  return l;
}

export function dimensionLines(area: Area): THREE.Object3D[] {
  const pts = areaOutline(area);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const off = 0.45;
  const tick = 0.15;
  const y = 0.02;
  const span = Math.max(M(x1 - x0), M(y1 - y0));
  const h = Math.max(0.25, span * 0.035);
  const out: THREE.Object3D[] = [];
  // Width, above the top edge.
  const zt = M(y0) - off;
  out.push(
    line([new THREE.Vector3(M(x0), y, zt), new THREE.Vector3(M(x1), y, zt)]),
    line([new THREE.Vector3(M(x0), y, zt - tick), new THREE.Vector3(M(x0), y, zt + tick)]),
    line([new THREE.Vector3(M(x1), y, zt - tick), new THREE.Vector3(M(x1), y, zt + tick)]),
  );
  const lw = label(fmt(x1 - x0), h);
  lw.position.set(M((x0 + x1) / 2), y + h, zt - h * 0.6);
  // Length, left of the left edge.
  const xl = M(x0) - off;
  out.push(
    lw,
    line([new THREE.Vector3(xl, y, M(y0)), new THREE.Vector3(xl, y, M(y1))]),
    line([new THREE.Vector3(xl - tick, y, M(y0)), new THREE.Vector3(xl + tick, y, M(y0))]),
    line([new THREE.Vector3(xl - tick, y, M(y1)), new THREE.Vector3(xl + tick, y, M(y1))]),
  );
  const ll = label(fmt(y1 - y0), h);
  ll.position.set(xl - h * 1.2, y + h, M((y0 + y1) / 2));
  out.push(ll);
  return out;
}
