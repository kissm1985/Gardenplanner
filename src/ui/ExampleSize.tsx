// Adding an example plan: in its own size, or fitted to the user's area (PL-FUN-04).
import { useMemo, useState } from 'react';
import { buildExample, EXAMPLE_PLANS, scaleArea } from '../data/examples';
import { itemCount } from '../engine/fill';
import { getLang, t } from '../i18n';
import { Sheet } from './Sheet';

const count = (items: Parameters<typeof itemCount>[0][]) => items.reduce((s, it) => s + itemCount(it), 0);

export function ExampleSizeSheet({
  exampleKey,
  onClose,
  onAdd,
}: {
  exampleKey: string | null;
  onClose: () => void;
  onAdd: (key: string, size?: { widthCm: number; lengthCm: number }) => void;
}) {
  const ex = EXAMPLE_PLANS.find((e) => e.key === exampleKey);
  const base = useMemo(() => (ex ? buildExample(ex) : null), [ex]);
  const [w, setW] = useState('');
  const [l, setL] = useState('');
  const round = base?.shape.kind === 'ellipse';
  const wn = Number(w) || base?.widthCm || 0;
  const ln = round ? wn : Number(l) || base?.lengthCm || 0;
  const valid = wn >= 50 && ln >= 50 && wn <= 10000 && ln <= 10000;
  const scaled = useMemo(() => (base && valid ? scaleArea(base, wn, ln) : null), [base, wn, ln, valid]);
  if (!ex || !base) return <Sheet open={false} title="" onClose={onClose} children={null} />;
  const name = getLang() === 'en' ? ex.name[1] : ex.name[0];
  const before = count(base.variants[0].items);
  const after = scaled ? count(scaled.variants[0].items) : before;
  const close = () => {
    setW('');
    setL('');
    onClose();
  };
  return (
    <Sheet open title={name} onClose={close}>
      <div className="form">
        <p className="mono muted">
          {t('Eredeti méret', 'Original size')}: {base.widthCm} × {base.lengthCm} cm · {t(`${before} tő`, `${before} plants`)}
        </p>
        <div className="field-row">
          <label className="field">
            <span>{round ? t('Átmérő (cm)', 'Diameter (cm)') : t('Szélesség (cm)', 'Width (cm)')}</span>
            <input inputMode="numeric" value={w} placeholder={String(base.widthCm)} onChange={(e) => setW(e.target.value.replace(/[^\d]/g, ''))} />
          </label>
          {!round && (
            <label className="field">
              <span>{t('Hosszúság (cm)', 'Length (cm)')}</span>
              <input inputMode="numeric" value={l} placeholder={String(base.lengthCm)} onChange={(e) => setL(e.target.value.replace(/[^\d]/g, ''))} />
            </label>
          )}
        </div>
        <p className="mono muted" role="status">
          {valid
            ? t(`A saját méretben kb. ${after} tő.`, `About ${after} plants in your size.`)
            : t('Adj meg 50 és 10 000 cm közötti méretet.', 'Enter a size between 50 and 10,000 cm.')}
        </p>
        <p className="mono muted">
          {t(
            'A foltok, sorok és elemek arányosan nyúlnak, a tőtáv marad, ezért a tőszám újraszámolódik; a fák és nagy cserjék mérete nem változik, csak a helyük.',
            'Beds, rows and elements stretch with the area, spacing stays, so plant counts are recounted; trees and large shrubs keep their size and only move.',
          )}
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!valid || (wn === base.widthCm && ln === base.lengthCm)}
            onClick={() => {
              onAdd(ex.key, { widthCm: wn, lengthCm: ln });
              close();
            }}
          >
            {t('Hozzáadás a saját méretben', 'Add in my size')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onAdd(ex.key);
              close();
            }}
          >
            {t('Eredeti méretben', 'In its own size')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
