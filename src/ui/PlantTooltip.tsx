import { effectivePlant, JUGLONE_LABEL, MONTHS, SOIL_LABEL, SUN_LABEL, TOXIC_LABEL, WATER_LABEL } from '../model/plants';
import type { PlacedItem, Plant } from '../model/types';
import { PlantChip } from './PlantChip';
import { STATUS_LABEL } from './Selection';
import { usePlantPhoto } from './plantPhoto';

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

/** Floating card on the plan with the most important facts (and a photo) of the plant under the pointer. */
export function PlantTooltip({ plant, item, x, y, boxW, boxH }: { plant: Plant; item: PlacedItem; x: number; y: number; boxW: number; boxH: number }) {
  const W = 260;
  // Keep the card inside the canvas: flip to the left/top near the edges.
  const left = x + 16 + W > boxW ? Math.max(8, x - 16 - W) : x + 16;
  const top = Math.min(Math.max(8, y + 16), Math.max(8, boxH - 340));
  return (
    <div className="plant-tip" style={{ left, top, width: W }} role="tooltip">
      <PlantCard plant={effectivePlant(plant, item)} item={item} />
    </div>
  );
}

/** Card content: photo, name, size, needs, bloom, toxicity, and the placed item if any. */
export function PlantCard({ plant, item }: { plant: Plant; item?: PlacedItem }) {
  const photo = usePlantPhoto(plant);
  const count = item ? (item.kind === 'plant' ? 1 : item.count) : 0;
  return (
    <>
      {photo.state === 'ok' && (
        <figure className="plant-tip-photo">
          <img src={photo.src} alt={`${plant.nameHu} (${plant.nameLat})`} loading="lazy" />
          <figcaption>
            Fotó: {photo.credit}
            {photo.own ? '' : ' · Wikimedia Commons'}
          </figcaption>
        </figure>
      )}
      {photo.state === 'loading' && <div className="plant-tip-photo is-empty">fotó betöltése…</div>}
      {photo.state === 'offline' && <div className="plant-tip-photo is-empty">A fotóhoz internet kell (első alkalommal).</div>}
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
        {item && (
          <>
            <dt>{KIND_LABEL[item.kind]}</dt>
            <dd>
              {count} tő · {STATUS_LABEL[item.status]}
            </dd>
          </>
        )}
      </dl>
      {!!plant.verify?.length && <p className="plant-tip-verify">Ellenőrizendő adat is van benne.</p>}
    </>
  );
}
