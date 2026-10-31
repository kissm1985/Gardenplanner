import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { JUGLONE_LABEL, MONTHS, plantName, SOIL_LABEL, SOILS, SUN_LABEL, TOXIC_LABEL, validatePlant, WATER_LABEL, FIELD_LABEL } from '../model/plants';
import type { JugloneTolerance, Plant, Soil, SunNeed, Toxicity, WaterNeed } from '../model/types';
import { usePlantPhoto } from './plantPhoto';
import { getLang, t, type Lang } from '../i18n';

interface Props {
  initial: Plant;
  others: Plant[];
  usedCount: number;
  isNew: boolean;
  onSave: (p: Plant) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function PlantForm({ initial, others, usedCount, isNew, onSave, onDelete, onCancel }: Props) {
  const [p, setP] = useState<Plant>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof Plant>(k: K, v: Plant[K]) => setP((x) => ({ ...x, [k]: v }));
  const checked = (k: keyof Plant) => setP((x) => ({ ...x, verify: (x.verify ?? []).filter((f) => f !== k) }));

  // Small label with an "ellenőrizendő" marker that can be cleared once checked.
  const L = ({ k, children }: { k: keyof Plant; children: ReactNode }) => (
    <span className="lbl">
      {children}
      {p.verify?.includes(k) && (
        <button type="button" className="verify-tag" onClick={() => checked(k)} title={t('Jelöld ellenőrzöttnek', 'Mark as checked')}>
          {t('ellenőrizendő ✓', 'to check ✓')}
        </button>
      )}
    </span>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validatePlant(p, others);
    setErrors(errs);
    if (!errs.length) onSave({ ...p, nameHu: p.nameHu.trim(), nameEn: p.nameEn?.trim() || undefined, nameLat: p.nameLat.trim() });
  };

  // Texts that exist in both languages: the app's language is edited up front, the other one below.
  type TextKey = 'name' | 'bloom' | 'foliage' | 'notes';
  const text = (k: TextKey, lang: Lang) => {
    if (lang === 'hu') return { name: p.nameHu, bloom: p.bloomColor, foliage: p.foliageColor, notes: p.notes }[k];
    return { name: p.nameEn, bloom: p.en?.bloomColor, foliage: p.en?.foliageColor, notes: p.en?.notes }[k] ?? '';
  };
  const setText = (k: TextKey, lang: Lang, v: string) => {
    if (lang === 'hu') setP((x) => ({ ...x, ...{ name: { nameHu: v }, bloom: { bloomColor: v }, foliage: { foliageColor: v }, notes: { notes: v } }[k] }));
    else if (k === 'name') setP((x) => ({ ...x, nameEn: v || undefined }));
    else {
      const key = ({ bloom: 'bloomColor', foliage: 'foliageColor', notes: 'notes' } as const)[k];
      setP((x) => ({ ...x, en: { ...x.en, [key]: v || undefined } }));
    }
  };
  const main = getLang();
  const other: Lang = main === 'hu' ? 'en' : 'hu';

  const toggleSoil = (x: Soil) => set('soil', p.soil?.includes(x) ? p.soil.filter((y) => y !== x) : [...(p.soil ?? []), x]);
  const toggleSun = (s: SunNeed) => set('sun', p.sun.includes(s) ? p.sun.filter((x) => x !== s) : [...p.sun, s]);
  const toggleMonth = (m: number) =>
    set('bloomMonths', p.bloomMonths.includes(m) ? p.bloomMonths.filter((x) => x !== m) : [...p.bloomMonths, m].sort((a, b) => a - b));

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field-row field-row-code">
        <label className="field">
          <L k="code">{t('Kód', 'Code')}</L>
          <input value={p.code} maxLength={2} onChange={(e) => set('code', e.target.value.toUpperCase())} autoCapitalize="characters" />
        </label>
        <label className="field">
          <L k={main === 'hu' ? 'nameHu' : 'nameEn'}>{t('Magyar név', 'Name')}</L>
          <input value={text('name', main)} onChange={(e) => setText('name', main, e.target.value)} />
        </label>
      </div>
      <label className="field">
        <L k="nameLat">{t('Latin név', 'Latin name')}</L>
        <input value={p.nameLat} onChange={(e) => set('nameLat', e.target.value)} lang="la" />
      </label>
      <div className="field-row field-row-3">
        <Num label={<L k="maxHeightCm">{t('Max. magasság (cm)', 'Max. height (cm)')}</L>} v={p.maxHeightCm} on={(v) => set('maxHeightCm', v)} />
        <Num label={<L k="spreadCm">{t('Kifejlett szélesség (cm)', 'Mature spread (cm)')}</L>} v={p.spreadCm} on={(v) => set('spreadCm', v)} />
        <Num label={<L k="spacingCm">{t('Tőtáv (cm)', 'Spacing (cm)')}</L>} v={p.spacingCm} on={(v) => set('spacingCm', v)} />
      </div>

      <fieldset className="field-group">
        <legend>
          <L k="sun">{t('Napigény', 'Light')}</L>
        </legend>
        <div className="seg">
          {(Object.keys(SUN_LABEL) as SunNeed[]).map((s) => (
            <label key={s} className="seg-item">
              <input type="checkbox" checked={p.sun.includes(s)} onChange={() => toggleSun(s)} />
              <span>{SUN_LABEL[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>
          <L k="soil">{t('Talaj (amiben jól fejlődik)', 'Soil (where it grows well)')}</L>
        </legend>
        <div className="seg">
          {SOILS.map((x) => (
            <label key={x} className="seg-item">
              <input type="checkbox" checked={!!p.soil?.includes(x)} onChange={() => toggleSoil(x)} />
              <span>{SOIL_LABEL[x]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field-row">
        <Sel label={<L k="water">{t('Vízigény', 'Water')}</L>} v={p.water} opts={WATER_LABEL} on={(v) => set('water', v as WaterNeed)} />
        <Sel label={<L k="juglone">{t('Juglone-tűrés', 'Juglone tolerance')}</L>} v={p.juglone} opts={JUGLONE_LABEL} on={(v) => set('juglone', v as JugloneTolerance)} />
      </div>
      <div className="field-row">
        <Sel label={<L k="toxic">{t('Mérgező', 'Toxic')}</L>} v={p.toxic} opts={TOXIC_LABEL} on={(v) => set('toxic', v as Toxicity)} />
        <label className="check">
          <input type="checkbox" checked={p.thorny} onChange={(e) => set('thorny', e.target.checked)} />
          <L k="thorny">{t('Tüskés', 'Thorny')}</L>
        </label>
      </div>

      <fieldset className="field-group">
        <legend>
          <L k="bloomMonths">{t('Virágzás', 'Flowering')}</L>
        </legend>
        <div className="months">
          {MONTHS.map((m, i) => (
            <label key={m} className="month">
              <input type="checkbox" checked={p.bloomMonths.includes(i + 1)} onChange={() => toggleMonth(i + 1)} />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field-row">
        <label className="field">
          <L k="bloomColor">{t('Virágszín', 'Flower colour')}</L>
          <input value={text('bloom', main)} onChange={(e) => setText('bloom', main, e.target.value)} />
        </label>
        <label className="field">
          <L k="foliageColor">{t('Lombszín', 'Foliage colour')}</L>
          <input value={text('foliage', main)} onChange={(e) => setText('foliage', main, e.target.value)} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={p.winterInterest} onChange={(e) => set('winterInterest', e.target.checked)} />
        <L k="winterInterest">{t('Télen is díszít', 'Winter interest')}</L>
      </label>

      <div className="field-row">
        <label className="field">
          <L k="pot">{t('Kiszerelés', 'Pot size')}</L>
          <input value={p.pot} onChange={(e) => set('pot', e.target.value)} placeholder={t('pl. P9, 1–2 l', 'e.g. P9, 1–2 l')} />
        </label>
        <Num label={<L k="unitPriceHuf">{t('Egységár (Ft)', 'Unit price (HUF)')}</L>} v={p.unitPriceHuf} on={(v) => set('unitPriceHuf', v)} />
      </div>
      <Sel
        label={<span className="lbl">{t('Ár forrása', 'Price source')}</span>}
        v={p.priceSource ?? 'estimate'}
        opts={{ shop: t('boltlista', 'shop list'), estimate: t('becslés', 'estimate') }}
        on={(v) => set('priceSource', v as 'shop' | 'estimate')}
      />

      <div className="field-row">
        <label className="field">
          <span className="lbl">{t('Szín a rajzon', 'Colour on the plan')}</span>
          <input type="color" value={p.color} onChange={(e) => set('color', e.target.value)} />
        </label>
        <Sel
          label={<span className="lbl">{t('Forma', 'Shape')}</span>}
          v={p.symbol ?? 'circle'}
          opts={{
            circle: t('kör', 'circle'),
            square: t('négyzet (talajtakaró)', 'square (ground cover)'),
            triangle: t('háromszög (fű)', 'triangle (grass)'),
            diamond: t('rombusz (fa)', 'diamond (tree)'),
          }}
          on={(v) => set('symbol', v as Plant['symbol'])}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={!!p.isTree} onChange={(e) => set('isTree', e.target.checked || undefined)} />
        <span>{t('Fa (a fák számát a terület korlátja figyeli)', 'Tree (the area limit counts trees)')}</span>
      </label>
      <label className="field">
        <span className="lbl">{t('Megjegyzés', 'Notes')}</span>
        <textarea rows={3} value={text('notes', main)} onChange={(e) => setText('notes', main, e.target.value)} />
      </label>
      <details className="field-group other-lang">
        <summary>{t('Angol szövegek (angol nyelvű nézethez)', 'Hungarian texts (for the Hungarian view)')}</summary>
        <label className="field">
          <span className="lbl">{t('Angol név', 'Hungarian name')}</span>
          <input value={text('name', other)} onChange={(e) => setText('name', other, e.target.value)} lang={other} />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="lbl">{t('Virágszín (angolul)', 'Flower colour (Hungarian)')}</span>
            <input value={text('bloom', other)} onChange={(e) => setText('bloom', other, e.target.value)} lang={other} />
          </label>
          <label className="field">
            <span className="lbl">{t('Lombszín (angolul)', 'Foliage colour (Hungarian)')}</span>
            <input value={text('foliage', other)} onChange={(e) => setText('foliage', other, e.target.value)} lang={other} />
          </label>
        </div>
        <label className="field">
          <span className="lbl">{t('Megjegyzés (angolul)', 'Notes (Hungarian)')}</span>
          <textarea rows={2} value={text('notes', other)} onChange={(e) => setText('notes', other, e.target.value)} lang={other} />
        </label>
      </details>

      <PhotoField p={p} set={set} />

      <fieldset className="field-group">
        <legend>{t('Adatok ellenőrzése', 'Data check')}</legend>
        <label className="field">
          <span className="lbl">{t('Adatforrás', 'Data source')}</span>
          <input
            value={p.dataSource ?? ''}
            onChange={(e) => set('dataSource', e.target.value || undefined)}
            placeholder={t('pl. faiskolai katalógus, szakkönyv, saját tapasztalat', 'e.g. nursery catalogue, reference book, own experience')}
          />
        </label>
        <label className="field">
          <span className="lbl">{t('Utolsó ellenőrzés', 'Last checked')}</span>
          <input type="date" value={p.checkedAt ?? ''} onChange={(e) => set('checkedAt', e.target.value || undefined)} />
        </label>
        <p className="mono muted">
          {p.verify?.length
            ? t(`Ellenőrizendő: ${p.verify.map((k) => FIELD_LABEL[k] ?? k).join(', ')}.`, `To check: ${p.verify.map((k) => FIELD_LABEL[k] ?? k).join(', ')}.`)
            : t('Nincs ellenőrizendő adat.', 'Nothing left to check.')}
        </p>
        {!!p.verify?.length && (
          <button type="button" className="btn btn-small" onClick={() => setP((x) => ({ ...x, verify: [], checkedAt: new Date().toISOString().slice(0, 10) }))}>
            {t('Mindent ellenőriztem (mai dátummal)', 'All checked (with today’s date)')}
          </button>
        )}
      </fieldset>

      {errors.length > 0 && (
        <div className="form-error" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <div className="form-actions">
        {onDelete && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              const msg = usedCount
                ? t(
                    `A(z) ${plantName(p)} ${usedCount} helyen szerepel a tervekben. Törlöd a növényt és ezeket a töveket is?`,
                    `${plantName(p)} is used in ${usedCount} places in the plans. Delete the plant and those plants too?`,
                  )
                : t(`Törlöd a(z) ${plantName(p)} növényt az adatbázisból?`, `Delete ${plantName(p)} from the database?`);
              if (confirm(msg)) onDelete();
            }}
          >
            {t('Törlés', 'Delete')}
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          {t('Mégse', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-primary">
          {isNew ? t('Hozzáadás', 'Add') : t('Mentés', 'Save')}
        </button>
      </div>
    </form>
  );
}

function Num({ label, v, on }: { label: ReactNode; v: number; on: (v: number) => void }) {
  return (
    <label className="field">
      {label}
      <input type="number" inputMode="decimal" min={0} value={Number.isFinite(v) ? v : ''} onChange={(e) => on(e.target.value === '' ? NaN : +e.target.value)} />
    </label>
  );
}

function Sel({ label, v, opts, on }: { label: ReactNode; v: string; opts: Record<string, string>; on: (v: string) => void }) {
  return (
    <label className="field">
      {label}
      <select value={v} onChange={(e) => on(e.target.value)}>
        {Object.entries(opts).map(([k, t]) => (
          <option key={k} value={k}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Downscale an image file to a JPEG data URL (max 640 px), so the project stays small. */
async function shrink(file: File, max = 640): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoField({ p, set }: { p: Plant; set: <K extends keyof Plant>(k: K, v: Plant[K]) => void }) {
  const photo = usePlantPhoto(p);
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const isData = p.photoUrl?.startsWith('data:');
  return (
    <fieldset className="field-group">
      <legend>{t('Fotó', 'Photo')}</legend>
      <div className="photo-field">
        {photo.state === 'ok' ? (
          <figure className="plant-tip-photo">
            <img src={photo.src} alt={plantName(p)} />
            <figcaption>
              {photo.own ? (
                t(`Saját fotó: ${photo.credit}`, `Own photo: ${photo.credit}`)
              ) : (
                <>
                  {t(`Wikipédia · ${photo.credit}`, `Wikipedia · ${photo.credit}`)}
                  {photo.licenseUrl && (
                    <>
                      {' · '}
                      <a href={photo.licenseUrl} target="_blank" rel="noopener">
                        {t('licenc', 'licence')}
                      </a>
                    </>
                  )}
                  {' · '}
                  <a href={photo.filePage ?? photo.pageUrl} target="_blank" rel="noopener">
                    {t('forrás', 'source')}
                  </a>
                </>
              )}
            </figcaption>
          </figure>
        ) : (
          <p className="mono muted">
            {photo.state === 'loading'
              ? t('Fotó keresése a Wikipédián…', 'Looking for a photo on Wikipedia…')
              : photo.state === 'offline'
                ? t('A Wikipédia-fotóhoz internet kell.', 'The Wikipedia photo needs internet.')
                : t('Nincs fotó. Tölts fel sajátot, vagy adj meg egy képlinket.', 'No photo. Upload your own or give an image link.')}
          </p>
        )}
      </div>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
          {t('Saját fotó feltöltése', 'Upload own photo')}
        </button>
        {p.photoUrl && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              set('photoUrl', undefined);
              set('photoCredit', undefined);
            }}
          >
            {t('Vissza a Wikipédia-fotóra', 'Back to the Wikipedia photo')}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              set('photoUrl', await shrink(f));
              set('photoCredit', t('saját fotó', 'own photo'));
              setErr('');
            } catch {
              setErr(t('Ezt a képet nem sikerült beolvasni.', 'This image could not be read.'));
            }
          }}
        />
      </div>
      <label className="field">
        <span className="lbl">{t('Képlink (pl. kertészet oldaláról)', 'Image link (e.g. from a nursery site)')}</span>
        <input
          type="url"
          inputMode="url"
          value={isData ? '' : (p.photoUrl ?? '')}
          placeholder={isData ? t('feltöltött kép', 'uploaded image') : 'https://…'}
          onChange={(e) => set('photoUrl', e.target.value.trim() || undefined)}
        />
      </label>
      {p.photoUrl && (
        <label className="field">
          <span className="lbl">{t('Fotó forrása / szerzője', 'Photo source / author')}</span>
          <input value={p.photoCredit ?? ''} onChange={(e) => set('photoCredit', e.target.value || undefined)} />
        </label>
      )}
      {err && <p className="form-error">{err}</p>}
    </fieldset>
  );
}
