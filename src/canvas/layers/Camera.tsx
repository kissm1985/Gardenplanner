import { CAMERA_FOV, coneLength } from '../../model/camera';
import type { Area, Camera } from '../../model/types';

const rad = (d: number) => (d * Math.PI) / 180;

/** Camera mark with its field of view: where the visualisation is seen from and where it looks. */
export function CameraMark({ cam, area, scale, editing = false }: { cam: Camera; area: Area; scale: number; editing?: boolean }) {
  const len = coneLength(area);
  const a = rad(cam.dir - CAMERA_FOV / 2);
  const b = rad(cam.dir + CAMERA_FOV / 2);
  const tip = (r: number, ang: number) => `${cam.x + r * Math.cos(ang)},${cam.y + r * Math.sin(ang)}`;
  const s = 1 / scale;
  const arrow = Math.min(len * 0.35, 90 * s);
  const d = rad(cam.dir);
  return (
    <g className={`camera${editing ? ' is-editing' : ''}`} pointerEvents="none">
      <path className="camera-cone" d={`M${cam.x},${cam.y} L${tip(len, a)} A${len},${len} 0 0 1 ${tip(len, b)} Z`} vectorEffect="non-scaling-stroke" />
      <line className="camera-dir" x1={cam.x} y1={cam.y} x2={cam.x + arrow * Math.cos(d)} y2={cam.y + arrow * Math.sin(d)} vectorEffect="non-scaling-stroke" />
      <g transform={`translate(${cam.x} ${cam.y}) rotate(${cam.dir}) scale(${s})`}>
        <rect className="camera-body" x={-11} y={-8} width={16} height={16} rx={3} />
        <path className="camera-lens" d="M5,-5 L13,-9 L13,9 L5,5 Z" />
      </g>
    </g>
  );
}
