import { effectivePlant, JUGLONE_LABEL, plantBloom, plantFoliage, plantName, MONTHS, SOIL_LABEL, SUN_LABEL, TOXIC_LABEL, WATER_LABEL } from '../model/plants';
import type { PlacedItem, Plant } from '../model/types';
import { PlantChip } from './PlantChip';
import { STATUS_LABEL } from './Selection';
import { usePlantPhoto } from './plantPhoto';
import { labels, t } from '../i18n';

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

const KIND_LABEL = labels({ plant: ['Egyedi tő', 'Single plant'], drift: ['Folt', 'Drift'], row: ['Sor', 'Row'] });

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
          <img src={photo.src} alt={`${plantName(plant)} (${plant.nameLat})`} loading="lazy" />
          <figcaption>
            {t('Fotó', 'Photo')}: {photo.credit}
            {photo.own ? '' : ' · Wikimedia Commons'}
          </figcaption>
        </figure>
      )}
      {photo.state === 'loading' && <div className="plant-tip-photo is-empty">{t('fotó betöltése…', 'loading photo…')}</div>}
      {photo.state === 'offline' && <div className="plant-tip-photo is-empty">{t('A fotóhoz internet kell (első alkalommal).', 'The photo needs internet (the first time).')}</div>}
      <div className="plant-tip-head">
        <PlantChip p={plant} size={30} />
        <div>
          <b>{plantName(plant)}</b>
          <i>{plant.nameLat}</i>
        </div>
      </div>
      <dl>
        <dt>{t('Méret', 'Size')}</dt>
        <dd>
          {t(
            `${plant.maxHeightCm} cm magas · ${plant.spreadCm} cm széles · tőtáv ${plant.spacingCm} cm`,
            `${plant.maxHeightCm} cm tall · ${plant.spreadCm} cm wide · spacing ${plant.spacingCm} cm`,
          )}
        </dd>
        <dt>{t('Igény', 'Needs')}</dt>
        <dd>
          {plant.sun.map((s) => SUN_LABEL[s]).join('/')} · {t('víz', 'water')}: {WATER_LABEL[plant.water]}
          {plant.soil?.length ? t(` · talaj: ${plant.soil.map((x) => SOIL_LABEL[x]).join(', ')}`, ` · soil: ${plant.soil.map((x) => SOIL_LABEL[x]).join(', ')}`) : ''}
        </dd>
        <dt>{t('Virágzás', 'Flowers')}</dt>
        <dd>{plant.bloomMonths.length ? `${monthRanges(plant.bloomMonths)}, ${plantBloom(plant)}` : t('nem virágzik feltűnően', 'no showy flowers')}</dd>
        <dt>{t('Lomb', 'Foliage')}</dt>
        <dd>
          {plantFoliage(plant)}
          {plant.winterInterest ? t(' · télen is díszít', ' · winter interest') : ''}
        </dd>
        <dt>{t('Mérgező', 'Toxic')}</dt>
        <dd>
          {TOXIC_LABEL[plant.toxic]}
          {plant.thorny ? t(' · tüskés', ' · thorny') : ''} · juglone: {JUGLONE_LABEL[plant.juglone]}
        </dd>
        {item && (
          <>
            <dt>{KIND_LABEL[item.kind]}</dt>
            <dd>
              {t(`${count} tő`, `${count} plants`)} · {STATUS_LABEL[item.status]}
            </dd>
          </>
        )}
      </dl>
      {!!plant.verify?.length && <p className="plant-tip-verify">{t('Ellenőrizendő adat is van benne.', 'Some data still needs checking.')}</p>}
    </>
  );
}
