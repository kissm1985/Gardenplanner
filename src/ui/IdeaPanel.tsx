import { useEffect, useState } from 'react';
import { DEFAULT_KINDS, generateIdea, KIND_LABEL, PALETTES, poolsFor, type Idea, type PaletteKey, type PlantKind } from '../engine/generator';
import { areaSunLevel, evaluate } from '../engine/rules';
import { SUN_LABEL, SOIL_LABEL } from '../model/plants';
import { AREA_KIND_LABEL } from '../model/types';
import { fillZone, type ZoneMode } from '../engine/zoneFill';
import { activeVariant, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { PlantMultiPicker } from './PlantMultiPicker';
import { startZoneEdit } from './ShapeEditBar';
import { PlantChip } from './PlantChip';

/** Idea generator: a whole new variant for the area, or random planting of a drawn region from my own list. */
export function IdeaPanel({ onDone }: { onDone: () => void }) {
  const area = useProject(selectCurrentArea);
  const zoneHere = useUi((s) => (s.zoneDraft?.areaId ?? s.lastZone?.areaId) === area?.id);
  const [tab, setTab] = useState<'whole' | 'zone'>(zoneHere ? 'zone' : 'whole');
  return (
    <div className="form">
      <div className="idea-tabs seg" role="tablist" aria-label="Ötletgenerátor módja">
        <button type="button" role="tab" className="chip-btn" aria-selected={tab === 'whole'} aria-pressed={tab === 'whole'} onClick={() => setTab('whole')}>
          Egész terület → új változat
        </button>
        <button type="button" role="tab" className="chip-btn" aria-selected={tab === 'zone'} aria-pressed={tab === 'zone'} onClick={() => setTab('zone')}>
          Kijelölt rész, saját listából
        </button>
      </div>
      {tab === 'whole' ? <WholeAreaIdea onDone={onDone} /> : <ZoneFillPanel onDone={onDone} />}
    </div>
  );
}

const DENSITY: { v: number; label: string }[] = [
  { v: 0.8, label: 'sűrűbb' },
  { v: 0.95, label: 'tőtáv szerint' },
  { v: 1.2, label: 'lazább' },
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
  const options = [...project.plantDb].sort((a, b) => a.nameHu.localeCompare(b.nameHu, 'hu')).map((p, i) => ({ p, score: i / 10000 }));
  const mine = last && last.areaId === area.id ? last : null;
  const alive = mine ? activeVariant(area).items.some((it) => mine.ids.includes(it.id)) : false;
  const byCode = new Map(project.plantDb.map((p) => [p.code, p]));
  const total = mine ? Object.values(mine.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <p className="mono muted">
        Válaszd ki a növényeket (és ha kell, az arányukat), aztán jelöld ki a rajzon a részt. A program véletlenszerűen, a tőtávot tartva ültet oda a listádból; a gyepet, burkolatot és a már
        ültetett töveket kikerüli. A szerkesztett változatba kerül, visszavonható.
      </p>
      <PlantMultiPicker area={area} options={options} picked={cfg.parts} onChange={(parts) => set({ parts })} label="Ezekből a növényekből" max={12} />
      <fieldset className="field-group">
        <legend>Elrendezés</legend>
        {(
          [
            ['mix', 'vegyesen – tövenként véletlenszerűen keverve'],
            ['groups', 'kisebb csoportokban – egy-egy fajból 5–9 tő együtt'],
          ] as [ZoneMode, string][]
        ).map(([m, l]) => (
          <label key={m} className="check">
            <input type="radio" name="zone-mode" checked={cfg.mode === m} onChange={() => set({ mode: m })} />
            <span>{l}</span>
          </label>
        ))}
        <label className="field">
          <span className="lbl">Sűrűség</span>
          <select value={cfg.density} onChange={(e) => set({ density: +e.target.value })}>
            {DENSITY.map((d) => (
              <option key={d.v} value={d.v}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={cfg.clear} onChange={(e) => set({ clear: e.target.checked })} />
          <span>A kijelölt részen lévő növényeket előtte eltávolítja</span>
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
          Rész kijelölése a rajzon
        </button>
        {mine && alive && (
          <button type="button" className="btn" disabled={!cfg.parts.length} onClick={() => run(mine.points, mine.ids)}>
            Újra ugyanide
          </button>
        )}
      </div>
      {mine && alive && (
        <div className="idea-result" aria-live="polite">
          <b>Kitöltve: {total} tő</b>
          <ul className="idea-species">
            {Object.entries(mine.counts).map(([code, n]) => {
              const p = byCode.get(code);
              return p ? (
                <li key={code}>
                  <PlantChip p={p} size={26} /> {p.nameHu} <span className="muted">{n} tő</span>
                </li>
              ) : null;
            })}
          </ul>
          {total === 0 && <p className="mono muted">Nem fért el egy tő sem: a rész túl kicsi, vagy már tele van.</p>}
          <div className="form-actions">
            <span className="spacer" />
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Megnézem a rajzon
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
      const n = area.variants.filter((v) => /^Ötlet \d+$/.test(v.name)).length + 1;
      const id = st.addVariantWith(`Ötlet ${n}`, next.items, notes, 'Ötletek');
      if (id) setIdea({ variantId: id, idea: next });
    }
  };

  const shown = variantAlive ? idea!.idea : null;
  const issues = shown ? evaluate(area, shown.items, project.plantDb, project.settings).filter((w) => w.severity !== 'info') : [];
  const planted = shown?.items.reduce((s, it) => s + (it.kind === 'plant' ? 1 : it.count), 0) ?? 0;

  return (
    <div className="form">
      <p className="mono muted">
        A terület feltételeihez illő fajokból ({SUN_LABEL[areaSunLevel(area)]}
        {c.maxHeightCm != null ? `, max. ${c.maxHeightCm} cm` : ''}
        {c.nonToxic ? ', nem mérgező' : ''}
        {c.noThorns ? ', tüske nélkül' : ''}
        {area.soil ? `, ${SOIL_LABEL[area.soil]} talaj` : ''}
        {area.kind ? `, ${AREA_KIND_LABEL[area.kind].toLowerCase()}` : ''}; {pool.length} faj jöhet szóba) véletlenszerű, de átgondolt összeállítás: egy színvilág, hátul a magasabbak, elöl
        az alacsonyabbak, ismétlődő ritmusban. Mindegyik ötlet külön változatba kerül, a meglévő terv nem változik.
      </p>
      <label className="field">
        <span className="lbl">Színvilág</span>
        <select value={palette} onChange={(e) => setPalette(e.target.value as PaletteKey | '')}>
          <option value="">Meglepetés</option>
          {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
            <option key={k} value={k}>
              {PALETTES[k].label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field-group">
        <legend>Milyen növények kerüljenek a tervre?</legend>
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
        <p className="mono muted">Sövény a hátsó szélre kerül, a fák egyenletesen elosztva, szabad hellyel körülöttük; a cserjék ritmusban előttük, az évelők foltokban elöl.</p>
      </fieldset>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-primary" onClick={() => run(false)} disabled={!kinds.length || pool.length < 1}>
          {shown ? 'Új ötlet új változatba' : 'Ötlet generálása'}
        </button>
        {shown && (
          <button type="button" className="btn" onClick={() => run(true)}>
            Újra (ebbe a változatba)
          </button>
        )}
      </div>
      {kinds.length > 0 && pool.length < 1 && <p className="form-error">Túl kevés faj felel meg a terület feltételeinek. Lazíts a korlátokon, vagy bővítsd az adatbázist.</p>}

      {shown && (
        <div className="idea-result" aria-live="polite">
          <b>
            {area.variants.find((v) => v.id === idea!.variantId)?.name}: {PALETTES[shown.palette].label} · {planted} tő
          </b>
          <ul className="idea-species">
            {shown.species.map((p) => (
              <li key={p.code}>
                <PlantChip p={p} size={26} /> {p.nameHu} <span className="muted">{p.maxHeightCm} cm · {p.bloomColor || p.foliageColor}</span>
              </li>
            ))}
          </ul>
          {shown.notes.map((n) => (
            <p key={n} className="mono muted">
              {n}
            </p>
          ))}
          <p className="mono">{issues.length ? `Szabályellenőrzés: ${issues.length} figyelmeztetés – nézd meg a Figyelmeztetések között.` : 'Szabályellenőrzés: nincs figyelmeztetés.'}</p>
          <div className="form-actions">
            <span className="spacer" />
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Megnézem a rajzon
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
