import { useState } from 'react';
import type { Fixture, FixtureType } from '../model/types';
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

  if (f) return <FixtureForm key={f.id} f={f} onBack={() => setEditing(null)} />;

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
                  {x.radius ? ` · sugár ${x.radius} cm` : x.w ? ` · ${x.w} × ${x.h} cm` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <h3 className="sub-h">Új elem a nézet közepére</h3>
      <div className="seg">
        {ADDABLE.map((t) => (
          <button key={t} type="button" className="btn btn-small" onClick={() => add(t)}>
            + {FIXTURE_LABEL[t]}
          </button>
        ))}
      </div>
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

function FixtureForm({ f, onBack }: { f: Fixture; onBack: () => void }) {
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
        <p className="mono muted">Ennek az elemnek szabad alakja van; az alakítás egy későbbi fázisban jön.</p>
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
