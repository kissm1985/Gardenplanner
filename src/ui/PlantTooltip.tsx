import { JUGLONE_LABEL, MONTHS, SOIL_LABEL, SUN_LABEL, TOXIC_LABEL, WATER_LABEL } from '../model/plants';
import type { PlacedItem, Plant } from '../model/types';
import { PlantChip } from './PlantChip';
import { STATUS_LABEL } from './Selection';

/** "jún–júl, szept" from bloom months. */
export function monthRanges(ms: number[]): string {
  const s = [...new Set(ms)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? MONTHS[s[i] - 1] : `${MONTHS[s[i] - 1]}–${MONTHS[s[j] - 1]}`);
    i = j + 1;
  }
  return out.join(', ');
}

const KIND_LABEL = { plant: 'Egyedi tő', drift: 'Folt', row: 'Sor' } as const;

/** Floating card with the most important facts about the plant under the pointer. */
export function PlantTooltip({ plant, item, x, y, boxW, boxH }: { plant: Plant; item: PlacedItem; x: number; y: number; boxW: number; boxH: number }) {
  const W = 260;
  // Keep the card inside the canvas: flip to the left/top near the edges.
  const left = x + 16 + W > boxW ? Math.max(8, x - 16 - W) : x + 16;
  const top = Math.min(Math.max(8, y + 16), Math.max(8, boxH - 190));
  const count = item.kind === 'plant' ? 1 : item.count;
  return (
    <div className="plant-tip" style={{ left, top, width: W }} role="tooltip">
      <div className="plant-tip-head">
        <PlantChip p={plant} size={30} />
        <div>
          <b>{plant.nameHu}</b>
          <i>{plant.nameLat}</i>
        </div>
      </div>
      <dl>
        <dt>Méret</dt>
        <dd>
          {plant.maxHeightCm} cm magas · {plant.spreadCm} cm széles · tőtáv {plant.spacingCm} cm
        </dd>
        <dt>Igény</dt>
        <dd>
          {plant.sun.map((s) => SUN_LABEL[s]).join('/')} · víz: {WATER_LABEL[plant.water]}
          {plant.soil?.length ? ` · talaj: ${plant.soil.map((x) => SOIL_LABEL[x]).join(', ')}` : ''}
        </dd>
        <dt>Virágzás</dt>
        <dd>{plant.bloomMonths.length ? `${monthRanges(plant.bloomMonths)}, ${plant.bloomColor}` : 'nem virágzik feltűnően'}</dd>
        <dt>Lomb</dt>
        <dd>
          {plant.foliageColor}
          {plant.winterInterest ? ' · télen is díszít' : ''}
        </dd>
        <dt>Mérgező</dt>
        <dd>
          {TOXIC_LABEL[plant.toxic]}
          {plant.thorny ? ' · tüskés' : ''} · juglone: {JUGLONE_LABEL[plant.juglone]}
        </dd>
        <dt>{KIND_LABEL[item.kind]}</dt>
        <dd>
          {count} tő · {STATUS_LABEL[item.status]}
        </dd>
      </dl>
      {!!plant.verify?.length && <p className="plant-tip-verify">Ellenőrizendő adat is van benne.</p>}
    </div>
  );
}
