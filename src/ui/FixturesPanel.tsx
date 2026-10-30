import { useRef, useState } from 'react';
import { polygonArea } from '../model/geometry';
import { FIXTURE_LABEL, newFixture, retype } from '../model/fixtures';
import type { Area, Fixture, FixtureType } from '../model/types';
import { startLawnEdit } from './ShapeEditBar';
import { selectCurrentArea, useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';
import { locale, t } from '../i18n';
import { loadImage } from './imageFile';

export { FIXTURE_LABEL };

const ADDABLE: FixtureType[] = ['walnut', 'tree', 'window', 'tap', 'manhole', 'paving', 'wall', 'fence', 'gravel', 'path', 'pond', 'well', 'shed', 'compost', 'rainBarrel', 'bench', 'raisedBed', 'other'];

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
      <p className="mono muted">
        {t(
          'Minden elem kijelölhető a rajzon egy koppintással (Kijelölés vagy Elemek eszköz): utána húzható, a sarkánál méretezhető. A nagy elemek (fal, kerítés, burkolat, gyep, tó…) csak kijelölés után mozdulnak.',
          'Every element can be selected on the plan with a tap (Select or Elements tool): then drag it or resize it at its corner. Large elements (wall, fence, paving, lawn, pond…) only move once selected.',
        )}
      </p>
      <ul className="fx-list">
        {area.fixtures.map((x) => (
          <li key={x.id}>
            <button type="button" className="plant-row" onClick={() => setEditing(x.id)}>
              <span className={`fx-dot fx-dot-${x.type}`} aria-hidden="true" />
              <span className="plant-row-text">
                <b>{x.label || FIXTURE_LABEL[x.type]}</b>
                <span className="mono muted">
                  {FIXTURE_LABEL[x.type]} · x {x.x} · y {x.y}
                  {x.polygon ? ` · ${m2(x.polygon)} m²` : x.radius ? t(` · sugár ${x.radius} cm`, ` · radius ${x.radius} cm`) : x.w ? ` · ${x.w} × ${x.h} cm` : ''}
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
          {t('+ Gyepsáv rajzolása', '+ Draw a lawn strip')}
        </button>
      </div>
      <p className="mono muted">
        {t(
          'A gyepre nem kerül növény: ha mégis oda tennél, figyelmeztet. A gyep nem számít bele az ágyás területébe (mulcs, talajtakarás).',
          'No plants go on the lawn: you get a warning if one does. The lawn does not count as bed area (mulch, cover).',
        )}
      </p>
      <h3 className="sub-h">{t('Új elem a nézet közepére', 'New element in the middle of the view')}</h3>
      <div className="seg">
        {ADDABLE.map((t) => (
          <button key={t} type="button" className="btn btn-small" onClick={() => add(t)}>
            + {FIXTURE_LABEL[t]}
          </button>
        ))}
      </div>
      <BackgroundSection area={area} onCalibrate={onDone} />
      <fieldset className="field-group">
        <legend>{t('Juglone-zóna (diófa körül)', 'Juglone zone (around walnuts)')}</legend>
        <label className="field">
          <span>
            {t('Sugár', 'Radius')}: {(settings.walnutRadiusCm / 100).toLocaleString(locale())} m
          </span>
          <input
            type="range"
            min={100}
            max={2500}
            step={50}
            value={settings.walnutRadiusCm}
            onChange={(e) => useProject.getState().updateSettings({ walnutRadiusCm: +e.target.value })}
          />
        </label>
        <p className="mono muted">{t('Alapérték 15 m: a dió gyökérzete a lombkoronánál jóval messzebbre ér.', 'Default 15 m: walnut roots reach well beyond the crown.')}</p>
      </fieldset>
    </div>
  );
}

const m2 = (pts: [number, number][]) => (polygonArea(pts) / 10000).toLocaleString(locale(), { maximumFractionDigits: 1 });

function FixtureForm({ f, onBack, onReshape }: { f: Fixture; onBack: () => void; onReshape: () => void }) {
  const upd = (patch: Partial<Fixture>) => useProject.getState().updateFixture(f.id, patch);
  const num = (k: 'x' | 'y' | 'w' | 'h' | 'radius', label: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        key={String(f[k])}
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
      {!f.polygon && (
        <label className="field">
          <span>{t('Típus', 'Type')}</span>
          <select value={f.type} onChange={(e) => upd(retype(f, e.target.value as FixtureType))}>
            {ADDABLE.map((ty) => (
              <option key={ty} value={ty}>
                {FIXTURE_LABEL[ty]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>{t('Felirat', 'Label')}</span>
        <input key={f.label} defaultValue={f.label ?? ''} onBlur={(e) => e.target.value !== (f.label ?? '') && upd({ label: e.target.value })} />
      </label>
      {!f.polygon && (
        <div className="field-row">
          {num('x', 'x (cm)')}
          {num('y', 'y (cm)')}
        </div>
      )}
      {f.radius != null ? (
        num('radius', f.type === 'walnut' ? t('Lombkorona sugara (cm)', 'Crown radius (cm)') : t('Sugár (cm)', 'Radius (cm)'))
      ) : !f.polygon ? (
        <div className="field-row">
          {num('w', t('Szélesség (cm)', 'Width (cm)'))}
          {num('h', t('Hossz (cm)', 'Length (cm)'))}
        </div>
      ) : (
        <>
          <p className="mono muted">
            {t(`Szabad alakú elem, ${f.polygon.length} sarokpont, ${m2(f.polygon)} m².`, `Free-shape element, ${f.polygon.length} corners, ${m2(f.polygon)} m².`)}
          </p>
          <div className="form-actions form-actions-start">
            <button type="button" className="btn btn-small" onClick={onReshape}>
              {t('Alak szerkesztése a rajzon', 'Edit the shape on the plan')}
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
          {t('Törlés', 'Delete')}
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={onBack}>
          {t('Kész', 'Done')}
        </button>
      </div>
    </div>
  );
}

function BackgroundSection({ area, onCalibrate }: { area: Area; onCalibrate: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const bg = area.background;
  const set = useProject.getState().setBackground;
  return (
    <fieldset className="field-group">
      <legend>{t('Háttérkép (fotó vagy tervrajz)', 'Background image (photo or drawing)')}</legend>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-small" onClick={() => ref.current?.click()}>
          {bg ? t('Csere', 'Replace') : t('Kép feltöltése', 'Upload image')}
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
              {t('Méretarány két ponttal', 'Scale with two points')}
            </button>
            <button type="button" className="btn btn-small btn-danger" onClick={() => set(null)}>
              {t('Törlés', 'Delete')}
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
            <span>
              {t('Átlátszatlanság', 'Opacity')}: {Math.round(bg.opacity * 100)}%
            </span>
            <input type="range" min={0.1} max={1} step={0.05} value={bg.opacity} onChange={(e) => set({ ...bg, opacity: +e.target.value })} />
          </label>
          <div className="field-row field-row-3">
            <BgNum label="x (cm)" v={bg.x} on={(x) => set({ ...bg, x })} />
            <BgNum label="y (cm)" v={bg.y} on={(y) => set({ ...bg, y })} />
            <BgNum label={t('Szélesség (cm)', 'Width (cm)')} v={bg.widthCm} on={(w) => w > 0 && set({ ...bg, widthCm: w })} />
          </div>
        </>
      )}
      <p className="mono muted">
        {t(
          'A kép a rajz alá kerül. Két ismert pont megjelölésével igazítod a méretarányt; a Nézet → Rétegek alatt ki is kapcsolható.',
          'The image goes under the plan. Mark two known points to set the scale; it can be hidden under View → Layers.',
        )}
      </p>
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
