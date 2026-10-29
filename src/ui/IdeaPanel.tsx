import { useEffect, useState } from 'react';
import { DEFAULT_KINDS, generateIdea, KIND_LABEL, PALETTES, poolsFor, type Idea, type PaletteKey, type PlantKind } from '../engine/generator';
import { areaSunLevel, evaluate } from '../engine/rules';
import { byPlantName, plantBloom, plantFoliage, plantName, SOIL_LABEL, SUN_LABEL } from '../model/plants';
import { AREA_KIND_LABEL } from '../model/types';
import { fillZone, type ZoneMode } from '../engine/zoneFill';
import { activeVariant, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { PlantMultiPicker } from './PlantMultiPicker';
import { startZoneEdit } from './ShapeEditBar';
import { PlantChip } from './PlantChip';
import { labels, t } from '../i18n';

/** Idea generator: a whole new variant for the area, or random planting of a drawn region from my own list. */
export function IdeaPanel({ onDone }: { onDone: () => void }) {
  const area = useProject(selectCurrentArea);
  const zoneHere = useUi((s) => (s.zoneDraft?.areaId ?? s.lastZone?.areaId) === area?.id);
  const [tab, setTab] = useState<'whole' | 'zone'>(zoneHere ? 'zone' : 'whole');
  return (
    <div className="form">
      <div className="idea-tabs seg" role="tablist" aria-label={t('Ötletgenerátor módja', 'Idea generator mode')}>
        <button type="button" role="tab" className="chip-btn" aria-selected={tab === 'whole'} aria-pressed={tab === 'whole'} onClick={() => setTab('whole')}>
          {t('Egész terület → új változat', 'Whole area → new variant')}
        </button>
        <button type="button" role="tab" className="chip-btn" aria-selected={tab === 'zone'} aria-pressed={tab === 'zone'} onClick={() => setTab('zone')}>
          {t('Kijelölt rész, saját listából', 'Selected region, my own list')}
        </button>
      </div>
      {tab === 'whole' ? <WholeAreaIdea onDone={onDone} /> : <ZoneFillPanel onDone={onDone} />}
    </div>
  );
}

const DENSITY_LABEL = labels({ dense: ['sűrűbb', 'denser'], normal: ['tőtáv szerint', 'by spacing'], loose: ['lazább', 'looser'] });
const DENSITY: { v: number; key: keyof typeof DENSITY_LABEL }[] = [
  { v: 0.8, key: 'dense' },
  { v: 0.95, key: 'normal' },
  { v: 1.2, key: 'loose' },
];

/** Draw a region on the plan; it is planted at random with the plants picked here (edited variant). */
function ZoneFillPanel({ onDone }: { onDone: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const cfg = useUi((s) => s.zoneConfig);
  const last = useUi((s) => s.lastZone);
  const ui = useUi.getState();
  const set = (patch: Partial<typeof cfg>) => ui.setZoneConfig({ ...cfg, ...patch });

  const run = (points: [number, number][], drop: string[] = []) => {
    if (!area) return;
    const items = activeVariant(area).items.filter((it) => !drop.includes(it.id));
    const res = fillZone({ area, polygon: points, parts: cfg.parts, plantDb: project.plantDb, existing: items, mode: cfg.mode, density: cfg.density, clear: cfg.clear });
    useProject.getState().applyFill(res.items, [...drop, ...res.removeIds]);
    ui.setLastZone({ areaId: area.id, points, ids: res.items.map((i) => i.id), counts: res.counts });
  };

  // Coming back from drawing: fill the new region straight away.
  useEffect(() => {
    const d = useUi.getState().zoneDraft;
    if (!d || !area || d.areaId !== area.id) return;
    useUi.getState().setZoneDraft(null);
    if (useUi.getState().zoneConfig.parts.length) run(d.points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!area) return null;
  const options = [...project.plantDb].sort(byPlantName).map((p, i) => ({ p, score: i / 10000 }));
  const mine = last && last.areaId === area.id ? last : null;
  const alive = mine ? activeVariant(area).items.some((it) => mine.ids.includes(it.id)) : false;
  const byCode = new Map(project.plantDb.map((p) => [p.code, p]));
  const total = mine ? Object.values(mine.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <p className="mono muted">
        {t(
          'Válaszd ki a növényeket (és ha kell, az arányukat), aztán jelöld ki a rajzon a részt. A program véletlenszerűen, a tőtávot tartva ültet oda a listádból; a gyepet, burkolatot és a már ültetett töveket kikerüli. A szerkesztett változatba kerül, visszavonható.',
          'Pick the plants (and their shares if you like), then mark the region on the plan. The app plants it at random from your list, keeping the spacing; it avoids the lawn, paving and existing plants. It goes into the edited variant and can be undone.',
        )}
      </p>
      <PlantMultiPicker area={area} options={options} picked={cfg.parts} onChange={(parts) => set({ parts })} label={t('Ezekből a növényekből', 'From these plants')} max={12} />
      <fieldset className="field-group">
        <legend>{t('Elrendezés', 'Layout')}</legend>
        {(
          [
            ['mix', t('vegyesen – tövenként véletlenszerűen keverve', 'mixed – plant by plant at random')],
            ['groups', t('kisebb csoportokban – egy-egy fajból 5–9 tő együtt', 'in small groups – 5–9 plants of one species together')],
          ] as [ZoneMode, string][]
        ).map(([m, l]) => (
          <label key={m} className="check">
            <input type="radio" name="zone-mode" checked={cfg.mode === m} onChange={() => set({ mode: m })} />
            <span>{l}</span>
          </label>
        ))}
        <label className="field">
          <span className="lbl">{t('Sűrűség', 'Density')}</span>
          <select value={cfg.density} onChange={(e) => set({ density: +e.target.value })}>
            {DENSITY.map((d) => (
              <option key={d.v} value={d.v}>
                {DENSITY_LABEL[d.key]}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.clear} onChange={(e) => set({ clear: e.target.checked })} />
          <span>{t('A kijelölt részen lévő növényeket előtte eltávolítja', 'Remove the plants in the region first')}</span>
        </label>
      </fieldset>
      <div className="form-actions form-actions-start">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!cfg.parts.length}
          onClick={() => {
            startZoneEdit(area);
            onDone();
          }}
        >
          {t('Rész kijelölése a rajzon', 'Mark the region on the plan')}
        </button>
        {mine && alive && (
          <button type="button" className="btn" disabled={!cfg.parts.length} onClick={() => run(mine.points, mine.ids)}>
            {t('Újra ugyanide', 'Again, same place')}
          </button>
        )}
      </div>
      {mine && alive && (
        <div className="idea-result" aria-live="polite">
          <b>{t(`Kitöltve: ${total} tő`, `Filled: ${total} plants`)}</b>
          <ul className="idea-species">
            {Object.entries(mine.counts).map(([code, n]) => {
              const p = byCode.get(code);
              return p ? (
                <li key={code}>
                  <PlantChip p={p} size={26} /> {plantName(p)} <span className="muted">{t(`${n} tő`, `${n} plants`)}</span>
                </li>
              ) : null;
            })}
          </ul>
          {total === 0 && <p className="mono muted">{t('Nem fért el egy tő sem: a rész túl kicsi, vagy már tele van.', 'Not a single plant fitted: the region is too small or already full.')}</p>}
          <div className="form-actions">
            <span className="spacer" />
            <button type="button" className="btn btn-primary" onClick={onDone}>
              {t('Megnézem a rajzon', 'Show me on the plan')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Random planting ideas that fit the current area; each idea goes into its own variant. */
function WholeAreaIdea({ onDone }: { onDone: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const [palette, setPalette] = useState<PaletteKey | ''>('');
  const [kinds, setKinds] = useState<PlantKind[]>(DEFAULT_KINDS);
  const [idea, setIdea] = useState<{ variantId: string; idea: Idea } | null>(null);
  if (!area) return null;
  const pools = poolsFor(area, project.plantDb, kinds);
  const pool = [...new Set([...pools.drift, ...pools.hedge, ...pools.shrub, ...pools.tree])];
  // Species available per type, to show next to each checkbox.
  const per = (k: PlantKind) => {
    const q = poolsFor(area, project.plantDb, [k]);
    return new Set([...q.drift, ...q.hedge, ...q.shrub, ...q.tree]).size;
  };
  const c = area.constraints;
  const variantAlive = idea && area.variants.some((v) => v.id === idea.variantId);

  const run = (again: boolean) => {
    const st = useProject.getState();
    const next = generateIdea(area, project.plantDb, project.settings, { palette: palette || undefined, kinds });
    const notes = next.notes.join(' ');
    if (again && idea && variantAlive) {
      st.setVariantItems(idea.variantId, next.items, notes);
      setIdea({ variantId: idea.variantId, idea: next });
    } else {
      const n = area.variants.filter((v) => /^(Ötlet|Idea) \d+$/.test(v.name)).length + 1;
      const id = st.addVariantWith(t(`Ötlet ${n}`, `Idea ${n}`), next.items, notes, t('Ötletek', 'Ideas'));
      if (id) setIdea({ variantId: id, idea: next });
    }
  };

  const shown = variantAlive ? idea!.idea : null;
  const issues = shown ? evaluate(area, shown.items, project.plantDb, project.settings).filter((w) => w.severity !== 'info') : [];
  const planted = shown?.items.reduce((s, it) => s + (it.kind === 'plant' ? 1 : it.count), 0) ?? 0;

  return (
    <div className="form">
      <p className="mono muted">
        {t('A terület feltételeihez illő fajokból', 'From species that suit the area')} ({SUN_LABEL[areaSunLevel(area)]}
        {c.maxHeightCm != null ? `, max. ${c.maxHeightCm} cm` : ''}
        {c.nonToxic ? t(', nem mérgező', ', non-toxic') : ''}
        {c.noThorns ? t(', tüske nélkül', ', no thorns') : ''}
        {area.soil ? t(`, ${SOIL_LABEL[area.soil]} talaj`, `, ${SOIL_LABEL[area.soil]} soil`) : ''}
        {area.kind ? `, ${AREA_KIND_LABEL[area.kind].toLowerCase()}` : ''}; {t(`${pool.length} faj jöhet szóba`, `${pool.length} species qualify`)}){' '}
        {t(
          'véletlenszerű, de átgondolt összeállítás: egy színvilág, hátul a magasabbak, elöl az alacsonyabbak, ismétlődő ritmusban. Mindegyik ötlet külön változatba kerül, a meglévő terv nem változik.',
          'a random but considered composition: one colour scheme, taller plants at the back, lower in front, in a repeating rhythm. Each idea goes into its own variant; the existing plan stays as it is.',
        )}
      </p>
      <label className="field">
        <span className="lbl">{t('Színvilág', 'Colour scheme')}</span>
        <select value={palette} onChange={(e) => setPalette(e.target.value as PaletteKey | '')}>
          <option value="">{t('Meglepetés', 'Surprise me')}</option>
          {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
            <option key={k} value={k}>
              {PALETTES[k].label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field-group">
        <legend>{t('Milyen növények kerüljenek a tervre?', 'Which kinds of plants?')}</legend>
        <div className="seg kind-seg">
          {(Object.keys(KIND_LABEL) as PlantKind[]).map((k) => {
            const n = per(k);
            return (
              <label key={k} className="seg-item">
                <input
                  type="checkbox"
                  checked={kinds.includes(k)}
                  disabled={!n && !kinds.includes(k)}
                  onChange={(e) => setKinds(e.target.checked ? [...kinds, k] : kinds.filter((x) => x !== k))}
                />
                <span>
                  {KIND_LABEL[k]} · {n}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mono muted">
          {t(
            'Sövény a hátsó szélre kerül, a fák egyenletesen elosztva, szabad hellyel körülöttük; a cserjék ritmusban előttük, az évelők foltokban elöl.',
            'A hedge goes along the back edge, trees evenly spread with room around them; shrubs in rhythm in front of them, perennials in drifts at the front.',
          )}
        </p>
      </fieldset>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-primary" onClick={() => run(false)} disabled={!kinds.length || pool.length < 1}>
          {shown ? t('Új ötlet új változatba', 'New idea in a new variant') : t('Ötlet generálása', 'Generate an idea')}
        </button>
        {shown && (
          <button type="button" className="btn" onClick={() => run(true)}>
            {t('Újra (ebbe a változatba)', 'Again (into this variant)')}
          </button>
        )}
      </div>
      {kinds.length > 0 && pool.length < 1 && <p className="form-error">{t('Túl kevés faj felel meg a terület feltételeinek. Lazíts a korlátokon, vagy bővítsd az adatbázist.', 'Too few species fit the area. Relax the limits or extend the database.')}</p>}

      {shown && (
        <div className="idea-result" aria-live="polite">
          <b>
            {area.variants.find((v) => v.id === idea!.variantId)?.name}: {PALETTES[shown.palette].label} · {t(`${planted} tő`, `${planted} plants`)}
          </b>
          <ul className="idea-species">
            {shown.species.map((p) => (
              <li key={p.code}>
                <PlantChip p={p} size={26} /> {plantName(p)}{' '}
                <span className="muted">
                  {p.maxHeightCm} cm · {plantBloom(p) !== '–' ? plantBloom(p) : plantFoliage(p)}
                </span>
              </li>
            ))}
          </ul>
          {shown.notes.map((n) => (
            <p key={n} className="mono muted">
              {n}
            </p>
          ))}
          <p className="mono">
            {issues.length
              ? t(`Szabályellenőrzés: ${issues.length} figyelmeztetés – nézd meg a Figyelmeztetések között.`, `Rule check: ${issues.length} warnings – see the Warnings list.`)
              : t('Szabályellenőrzés: nincs figyelmeztetés.', 'Rule check: no warnings.')}
          </p>
          <div className="form-actions">
            <span className="spacer" />
            <button type="button" className="btn btn-primary" onClick={onDone}>
              {t('Megnézem a rajzon', 'Show me on the plan')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
