import { useMemo, useRef, useState, type ReactNode } from 'react';
import { bomTable, buildBom, fmtFt, fmtInt, STATUSES, toCsv, toHtmlTable, toText, toTsv } from '../engine/bom';
import { buildXlsx } from '../engine/xlsx';
import { JUGLONE_LABEL, WATER_LABEL } from '../model/plants';
import type { ItemStatus } from '../model/types';
import { useProject } from '../store/projectStore';
import { downloadBlob, downloadText } from './download';
import { PlantChip } from './PlantChip';
import { STATUS_LABEL } from './Selection';

type Scope = 'all' | string;

/** Copy with fallbacks: rich (HTML + text) → plain text → execCommand on the visible textarea. */
async function copy(text: string, ta: HTMLTextAreaElement | null, html?: string): Promise<boolean> {
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) }),
      ]);
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  if (!ta) return false;
  ta.value = text;
  ta.focus();
  ta.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/** Plant list and shopping (SPEC §4.6). */
export function ListView() {
  const project = useProject((s) => s.project)!;
  const [scope, setScope] = useState<Scope>('all');
  const [status, setStatus] = useState<ItemStatus | null>(null);
  const [toast, setToast] = useState('');
  const [fallback, setFallback] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const areaIds = scope === 'all' ? project.areas.map((a) => a.id) : [scope];
  const bom = useMemo(() => buildBom(project, areaIds, status), [project, scope, status]);
  const table = useMemo(() => bomTable(bom), [bom]);
  const title = scope === 'all' ? project.name : (project.areas.find((a) => a.id === scope)?.name ?? '');
  const fileBase = `novenylista-${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;

  const say = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 3000);
  };
  const doCopy = async (text: string, label: string, html?: string) => {
    setFallback(text);
    const ok = await copy(text, taRef.current, html);
    say(ok ? `${label} kimásolva.` : 'A másolás itt nem működik: jelöld ki a lenti mezőt, és másold kézzel.');
  };

  const xlsx = () => {
    const sheets = [{ name: scope === 'all' ? 'Összesen' : title, rows: table }];
    if (scope === 'all' && project.areas.length > 1)
      for (const a of project.areas) sheets.push({ name: a.name, rows: bomTable(buildBom(project, [a.id], status)) });
    downloadBlob(`${fileBase}.xlsx`, buildXlsx(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const share = async () => {
    const text = toText(bom, title);
    try {
      const file = new File(['﻿' + toCsv(table)], `${fileBase}.csv`, { type: 'text/csv' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: `${title} – növénylista`, text, files: [file] });
      else await navigator.share({ title: `${title} – növénylista`, text });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') say('A megosztás nem sikerült.');
    }
  };

  const perArea = bom.areas.length > 1;

  return (
    <div className="listview">
      <header className="lv-head">
        <div className="eyebrow">Növénylista · a választott változatokból</div>
        <div className="seg" role="group" aria-label="Terület">
          <ScopeChip on={scope === 'all'} onClick={() => setScope('all')}>
            Összesítve
          </ScopeChip>
          {project.areas.map((a) => (
            <ScopeChip key={a.id} on={scope === a.id} onClick={() => setScope(a.id)}>
              {a.name}
            </ScopeChip>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Státusz szűrő">
          <ScopeChip on={!status} onClick={() => setStatus(null)}>
            mind
          </ScopeChip>
          {STATUSES.map((s) => (
            <ScopeChip key={s} on={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </ScopeChip>
          ))}
        </div>
      </header>

      <div className="lv-sum">
        <div>
          <span className="k">Ültetés</span>
          <span className="v">{fmtInt(bom.planted)} tő</span>
        </div>
        <div>
          <span className="k">Rendelés</span>
          <span className="v">{fmtInt(bom.order)} db</span>
          <label className="reserve">
            tartalék
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={project.settings.reservePct}
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, Math.round(+e.target.value || 0)));
                useProject.getState().updateSettings({ reservePct: v });
              }}
              aria-label="Rendelési tartalék százalékban"
            />
            %
          </label>
        </div>
        <div>
          <span className="k">Becsült költség</span>
          <span className="v">{fmtFt(bom.total)}</span>
          {bom.estimated > 0 && <small className="mono muted">{bom.estimated} tétel ára becslés</small>}
          {bom.unpriced > 0 && <small className="mono warn-text">{bom.unpriced} tételnek nincs ára</small>}
        </div>
      </div>

      <div className="lv-tools">
        <button type="button" className="btn btn-primary btn-small" onClick={() => doCopy(toText(bom, title), 'A lista')}>
          Másolás szövegként
        </button>
        <button type="button" className="btn btn-small" onClick={() => doCopy(toTsv(table), 'A táblázat', toHtmlTable(table))}>
          Másolás táblázatként (Excel)
        </button>
        <button type="button" className="btn btn-small" onClick={() => downloadText(`${fileBase}.csv`, toCsv(table), 'text/csv;charset=utf-8')}>
          CSV
        </button>
        <button type="button" className="btn btn-small" onClick={xlsx}>
          XLSX
        </button>
        {canShare && (
          <button type="button" className="btn btn-small" onClick={share}>
            Megosztás
          </button>
        )}
        <span className="toast" role="status">
          {toast}
        </span>
      </div>

      {bom.rows.length === 0 ? (
        <p className="empty lv-empty">
          {status ? `Nincs „${STATUS_LABEL[status]}” státuszú tő.` : 'Még nincs növény a tervben. Helyezz el néhányat a Növény, Folt vagy Sor eszközzel.'}
        </p>
      ) : (
        <div className="tw">
          <table className="bom">
            <thead>
              <tr>
                <th>Növény</th>
                {perArea && bom.areas.map((a) => <th key={a.id} className="m">{a.name}</th>)}
                <th className="m">Ültetés</th>
                <th className="m">Rendelés</th>
                <th>Kiszerelés</th>
                <th className="m">Max.</th>
                <th className="m">Tőtáv</th>
                <th>Víz</th>
                <th>Juglone</th>
                <th className="m">Egységár</th>
                <th className="m">Részösszeg</th>
                <th>Státusz</th>
              </tr>
            </thead>
            <tbody>
              {bom.rows.map((r) => (
                <tr key={r.plant.code}>
                  <td>
                    <span className="bom-name">
                      <PlantChip p={r.plant} size={28} />
                      <span>
                        {r.plant.nameHu}
                        {r.plant.isTree ? ' (fa)' : ''}
                        <small>{r.plant.nameLat}</small>
                      </span>
                    </span>
                  </td>
                  {perArea && bom.areas.map((a) => <td key={a.id} className="m">{r.byArea[a.id] ?? '–'}</td>)}
                  <td className="m">{r.planted}</td>
                  <td className="m">
                    <b>{r.order}</b>
                  </td>
                  <td className="m">{r.plant.pot}</td>
                  <td className="m">{r.plant.maxHeightCm} cm</td>
                  <td className="m">{r.plant.spacingCm} cm</td>
                  <td>{WATER_LABEL[r.plant.water]}</td>
                  <td>{JUGLONE_LABEL[r.plant.juglone]}</td>
                  <td className="m">
                    {r.plant.unitPriceHuf ? fmtInt(r.plant.unitPriceHuf) : '–'}
                    <span className={`tag${r.plant.priceSource === 'shop' ? ' s' : ''}`}>{r.plant.priceSource === 'shop' ? 'bolt' : 'becsl.'}</span>
                  </td>
                  <td className="m">{fmtInt(r.subtotal)}</td>
                  <td>
                    <StatusCell
                      counts={r.byStatus}
                      onSet={(s) => useProject.getState().setSpeciesStatus(r.plant.code, s, areaIds, status)}
                      label={r.plant.nameHu}
                    />
                  </td>
                </tr>
              ))}
              <tr className="tot">
                <td>Összesen</td>
                {perArea && bom.areas.map((a) => <td key={a.id} className="m">{bom.rows.reduce((s, r) => s + (r.byArea[a.id] ?? 0), 0)}</td>)}
                <td className="m">{bom.planted}</td>
                <td className="m">{bom.order}</td>
                <td colSpan={5} />
                <td />
                <td className="m">{fmtInt(bom.total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <label className="field lv-fallback">
        <span>Tartalék szövegmező: ha a másolás gomb nem működik, jelöld ki és másold innen</span>
        <textarea ref={taRef} readOnly rows={6} value={fallback || toText(bom, title)} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
      </label>
      <p className="mono muted lv-note">
        A rendelendő mennyiség az ültetett darabszám + {bom.reservePct}%, felfelé kerekítve; a fáknál nincs tartalék. Az árak bruttó becslések (K-08), vásárlás előtt ellenőrizd.
      </p>
    </div>
  );
}

function ScopeChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip-btn" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function StatusCell({ counts, onSet, label }: { counts: Record<ItemStatus, number>; onSet: (s: ItemStatus) => void; label: string }) {
  const parts = STATUSES.filter((s) => counts[s]).map((s) => `${STATUS_LABEL[s]}: ${counts[s]}`);
  return (
    <span className="status-cell">
      <span className="mono">{parts.join(' · ')}</span>
      <select value="" onChange={(e) => e.target.value && onSet(e.target.value as ItemStatus)} aria-label={`${label} státusza`}>
        <option value="">mind →</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </span>
  );
}
