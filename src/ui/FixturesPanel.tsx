import { useRef, useState } from 'react';
import { polygonArea } from '../model/geometry';
import type { Area, Fixture, FixtureType } from '../model/types';
import { startLawnEdit } from './ShapeEditBar';
import { selectCurrentArea, useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';

export const FIXTURE_LABEL: Record<FixtureType, string> = {
  walnut: 'Diófa',
  tree: 'Fa',
  window: 'Ablak',
  tap: 'Csap',
  manhole: 'Akna',
  paving: 'Burkolat',
  fence: 'Kerítés',
  lawn: 'Gyep',
  wall: 'Fal',
  other: 'Egyéb',
};

/** Defaults for a new fixture, centred on (x, y). */
function newFixture(type: FixtureType, x: number, y: number): Omit<Fixture, 'id'> {
  const label = FIXTURE_LABEL[type];
  switch (type) {
    case 'walnut':
      return { type, label, x, y, radius: 450 };
    case 'tree':
      return { type, label, x, y, radius: 150 };
    case 'window':
      return { type, label, x: x - 60, y: y - 10, w: 120, h: 20 };
    case 'paving':
      return { type, label, x: x - 50, y: y - 50, w: 100, h: 100 };
    case 'fence':
      return { type, label, x: x - 3, y: y - 100, w: 6, h: 200 };
    default:
      return { type, label, x: x - 20, y: y - 20, w: 40, h: 40 };
  }
}

const ADDABLE: FixtureType[] = ['walnut', 'tree', 'window', 'tap', 'manhole', 'paving', 'fence', 'other'];

/** List, add and edit fixed elements; walnut juglone radius setting. */
export function FixturesPanel({ onDone }: { onDone: () => void }) {
  const area = useProject(selectCurrentArea);
  const settings = useProject((s) => s.project!.settings);
  const selected = useUi((s) => s.selectedFixture);
  const [editing, setEditing] = useState<string | null>(selected);
  if (!area) return null;
  const f = area.fixtures.find((x) => x.id === editing);

  if (f)
    return (
      <FixtureForm
        key={f.id}
        f={f}
        onBack={() => setEditing(null)}
        onReshape={() => {
          startLawnEdit(area, f);
          onDone();
        }}
      />
    );

  const add = (type: FixtureType) => {
    const [x, y] = canvasBridge.center?.() ?? [area.widthCm / 2, area.lengthCm / 2];
    const id = useProject.getState().addFixture(newFixture(type, Math.round(x), Math.round(y)));
    if (id) {
      useUi.getState().setTool('select');
      useUi.getState().selectFixture(id);
    }
    onDone();
  };

  return (
    <div className="form">
      <p className="mono muted">A diófa, fa, ablak, csap és akna a rajzon Kijelölés módban húzható.</p>
      <ul className="fx-list">
        {area.fixtures.map((x) => (
          <li key={x.id}>
            <button type="button" className="plant-row" onClick={() => setEditing(x.id)}>
              <span className={`fx-dot fx-dot-${x.type}`} aria-hidden="true" />
              <span className="plant-row-text">
                <b>{x.label || FIXTURE_LABEL[x.type]}</b>
                <span className="mono muted">
                  {FIXTURE_LABEL[x.type]} · x {x.x} · y {x.y}
                  {x.polygon ? ` · ${m2(x.polygon)} m²` : x.radius ? ` · sugár ${x.radius} cm` : x.w ? ` · ${x.w} × ${x.h} cm` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="form-actions form-actions-start">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            startLawnEdit(area);
            onDone();
          }}
        >
          + Gyepsáv rajzolása
        </button>
      </div>
      <p className="mono muted">A gyepre nem kerül növény: ha mégis oda tennél, figyelmeztet. A gyep nem számít bele az ágyás területébe (mulcs, talajtakarás).</p>
      <h3 className="sub-h">Új elem a nézet közepére</h3>
      <div className="seg">
        {ADDABLE.map((t) => (
          <button key={t} type="button" className="btn btn-small" onClick={() => add(t)}>
            + {FIXTURE_LABEL[t]}
          </button>
        ))}
      </div>
      <BackgroundSection area={area} onCalibrate={onDone} />
      <fieldset className="field-group">
        <legend>Juglone-zóna (diófa körül)</legend>
        <label className="field">
          <span>Sugár: {(settings.walnutRadiusCm / 100).toLocaleString('hu-HU')} m</span>
          <input
            type="range"
            min={100}
            max={2500}
            step={50}
            value={settings.walnutRadiusCm}
            onChange={(e) => useProject.getState().updateSettings({ walnutRadiusCm: +e.target.value })}
          />
        </label>
        <p className="mono muted">Alapérték 15 m: a dió gyökérzete a lombkoronánál jóval messzebbre ér.</p>
      </fieldset>
    </div>
  );
}

const m2 = (pts: [number, number][]) => (polygonArea(pts) / 10000).toLocaleString('hu-HU', { maximumFractionDigits: 1 });

function FixtureForm({ f, onBack, onReshape }: { f: Fixture; onBack: () => void; onReshape: () => void }) {
  const upd = (patch: Partial<Fixture>) => useProject.getState().updateFixture(f.id, patch);
  const num = (k: 'x' | 'y' | 'w' | 'h' | 'radius', label: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        defaultValue={f[k] ?? ''}
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && v !== f[k]) upd({ [k]: v });
        }}
      />
    </label>
  );
  return (
    <div className="form">
      <label className="field">
        <span>Felirat</span>
        <input defaultValue={f.label ?? ''} onBlur={(e) => e.target.value !== (f.label ?? '') && upd({ label: e.target.value })} />
      </label>
      {!f.polygon && (
        <div className="field-row">
          {num('x', 'x (cm)')}
          {num('y', 'y (cm)')}
        </div>
      )}
      {f.radius != null ? (
        num('radius', f.type === 'walnut' ? 'Lombkorona sugara (cm)' : 'Sugár (cm)')
      ) : !f.polygon ? (
        <div className="field-row">
          {num('w', 'Szélesség (cm)')}
          {num('h', 'Hossz (cm)')}
        </div>
      ) : (
        <>
          <p className="mono muted">
            Szabad alakú elem, {f.polygon.length} sarokpont, {m2(f.polygon)} m².
          </p>
          <div className="form-actions form-actions-start">
            <button type="button" className="btn btn-small" onClick={onReshape}>
              Alak szerkesztése a rajzon
            </button>
          </div>
        </>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            useProject.getState().deleteFixture(f.id);
            useUi.getState().selectFixture(null);
            onBack();
          }}
        >
          Törlés
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={onBack}>
          Kész
        </button>
      </div>
    </div>
  );
}

/** Downscale a photo to keep the project (and its JSON backup) small. */
async function loadImage(file: File, maxPx = 1600): Promise<{ dataUrl: string; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Ezt a képet nem lehet megnyitni.'));
      img.src = url;
    });
    const k = Math.min(1, maxPx / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/jpeg', 0.82), aspect: img.height / img.width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function BackgroundSection({ area, onCalibrate }: { area: Area; onCalibrate: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const bg = area.background;
  const set = useProject.getState().setBackground;
  return (
    <fieldset className="field-group">
      <legend>Háttérkép (fotó vagy tervrajz)</legend>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-small" onClick={() => ref.current?.click()}>
          {bg ? 'Csere' : 'Kép feltöltése'}
        </button>
        {bg && (
          <>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                useUi.getState().setTool('select');
                useUi.getState().setCalibrate([]);
                onCalibrate();
              }}
            >
              Méretarány két ponttal
            </button>
            <button type="button" className="btn btn-small btn-danger" onClick={() => set(null)}>
              Törlés
            </button>
          </>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const { dataUrl, aspect } = await loadImage(f);
              set({ dataUrl, aspect, opacity: bg?.opacity ?? 0.5, x: 0, y: 0, widthCm: area.widthCm });
              setErr('');
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        />
      </div>
      {bg && (
        <>
          <label className="field">
            <span>Átlátszatlanság: {Math.round(bg.opacity * 100)}%</span>
            <input type="range" min={0.1} max={1} step={0.05} value={bg.opacity} onChange={(e) => set({ ...bg, opacity: +e.target.value })} />
          </label>
          <div className="field-row field-row-3">
            <BgNum label="x (cm)" v={bg.x} on={(x) => set({ ...bg, x })} />
            <BgNum label="y (cm)" v={bg.y} on={(y) => set({ ...bg, y })} />
            <BgNum label="Szélesség (cm)" v={bg.widthCm} on={(w) => w > 0 && set({ ...bg, widthCm: w })} />
          </div>
        </>
      )}
      <p className="mono muted">A kép a rajz alá kerül. Két ismert pont megjelölésével igazítod a méretarányt; a Nézet → Rétegek alatt ki is kapcsolható.</p>
      {err && <p className="form-error">{err}</p>}
    </fieldset>
  );
}

function BgNum({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        key={v}
        type="number"
        inputMode="decimal"
        defaultValue={Math.round(v * 10) / 10}
        onBlur={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n) && n !== v) on(n);
        }}
      />
    </label>
  );
}
