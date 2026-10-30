import { useMemo, useRef, useState, type ReactNode } from 'react';
import { bomTable, buildBom, fmtFt, fmtInt, STATUSES, toCsv, toHtmlTable, toText, toTsv } from '../engine/bom';
import { buildXlsx } from '../engine/xlsx';
import { JUGLONE_LABEL, plantName, WATER_LABEL } from '../model/plants';
import type { ItemStatus } from '../model/types';
import { activeVariant, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { downloadBlob, downloadText } from './download';
import { PlantChip } from './PlantChip';
import { STATUS_LABEL } from './Selection';
import { copy } from './clipboard';
import { t } from '../i18n';

type Scope = 'all' | string;
type Source = 'shown' | 'chosen';

/** Plant list and shopping (SPEC §4.6). */
export function ListView() {
  const project = useProject((s) => s.project)!;
  const current = useProject(selectCurrentArea);
  // Default: the plan on screen – the current area's shown variant.
  const [scope, setScope] = useState<Scope>(current?.id ?? 'all');
  const [source, setSource] = useState<Source>('shown');
  const [status, setStatus] = useState<ItemStatus | null>(null);
  const [toast, setToast] = useState('');
  const [fallback, setFallback] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const areaIds = scope === 'all' ? project.areas.map((a) => a.id) : [scope];
  const bom = useMemo(() => buildBom(project, areaIds, status, source), [project, scope, status, source]);
  const table = useMemo(() => bomTable(bom), [bom]);
  const title = scope === 'all' ? project.name : (project.areas.find((a) => a.id === scope)?.name ?? '');
  const fileBase = `${t('novenylista', 'plant-list')}-${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((x) => (x === msg ? '' : x)), 3000);
  };
  const doCopy = async (text: string, label: string, html?: string) => {
    setFallback(text);
    const ok = await copy(text, taRef.current, html);
    say(ok ? t(`${label} kimásolva.`, `${label} copied.`) : t('A másolás itt nem működik: jelöld ki a lenti mezőt, és másold kézzel.', 'Copying does not work here: select the box below and copy by hand.'));
  };

  const xlsx = () => {
    const sheets = [{ name: scope === 'all' ? t('Összesen', 'Total') : title, rows: table }];
    if (scope === 'all' && project.areas.length > 1)
      for (const a of project.areas) sheets.push({ name: a.name, rows: bomTable(buildBom(project, [a.id], status, source)) });
    downloadBlob(`${fileBase}.xlsx`, buildXlsx(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const share = async () => {
    const text = toText(bom, title);
    try {
      const file = new File(['﻿' + toCsv(table)], `${fileBase}.csv`, { type: 'text/csv' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: t(`${title} – növénylista`, `${title} – plant list`), text, files: [file] });
      else await navigator.share({ title: t(`${title} – növénylista`, `${title} – plant list`), text });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') say(t('A megosztás nem sikerült.', 'Sharing failed.'));
    }
  };

  const perArea = bom.areas.length > 1;
  const scoped = scope === 'all' ? null : project.areas.find((a) => a.id === scope);
  const eyebrow =
    source === 'shown'
      ? scoped
        ? t(`Növénylista · látható terv: ${activeVariant(scoped).name}`, `Plant list · plan on screen: ${activeVariant(scoped).name}`)
        : t('Növénylista · a látható tervekből', 'Plant list · from the plans on screen')
      : t('Növénylista · a választott változatokból', 'Plant list · from the chosen variants');

  return (
    <div className="listview">
      <header className="lv-head">
        <div className="eyebrow">{eyebrow}</div>
        <button type="button" className="btn btn-small" onClick={() => useUi.getState().setPage('schedule')}>
          {t('Ültetési menetrend és gondozás →', 'Planting schedule and care →')}
        </button>
        <div className="seg" role="group" aria-label={t('Melyik változat', 'Which variant')}>
          <ScopeChip on={source === 'shown'} onClick={() => setSource('shown')}>
            {t('Látható terv', 'Plan on screen')}
          </ScopeChip>
          <ScopeChip on={source === 'chosen'} onClick={() => setSource('chosen')}>
            {t('★ Választott változatok', '★ Chosen variants')}
          </ScopeChip>
        </div>
        <div className="seg" role="group" aria-label={t('Terület', 'Area')}>
          <ScopeChip on={scope === 'all'} onClick={() => setScope('all')}>
            {t('Összesítve', 'Combined')}
          </ScopeChip>
          {project.areas.map((a) => (
            <ScopeChip key={a.id} on={scope === a.id} onClick={() => setScope(a.id)}>
              {a.name}
            </ScopeChip>
          ))}
        </div>
        <div className="seg" role="group" aria-label={t('Státusz szűrő', 'Status filter')}>
          <ScopeChip on={!status} onClick={() => setStatus(null)}>
            {t('mind', 'all')}
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
          <span className="k">{t('Ültetés', 'Planting')}</span>
          <span className="v">{t(`${fmtInt(bom.planted)} tő`, `${fmtInt(bom.planted)} plants`)}</span>
        </div>
        <div>
          <span className="k">{t('Rendelés', 'Order')}</span>
          <span className="v">{t(`${fmtInt(bom.order)} db`, `${fmtInt(bom.order)}`)}</span>
          <label className="reserve">
            {t('tartalék', 'spare')}
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
              aria-label={t('Rendelési tartalék százalékban', 'Spare for ordering, in percent')}
            />
            %
          </label>
        </div>
        <div>
          <span className="k">{t('Becsült költség', 'Estimated cost')}</span>
          <span className="v">{fmtFt(bom.total)}</span>
          {bom.estimated > 0 && <small className="mono muted">{t(`${bom.estimated} tétel ára becslés`, `${bom.estimated} prices are estimates`)}</small>}
          {bom.unpriced > 0 && <small className="mono warn-text">{t(`${bom.unpriced} tételnek nincs ára`, `${bom.unpriced} items have no price`)}</small>}
        </div>
      </div>

      <div className="lv-tools">
        <button type="button" className="btn btn-primary btn-small" onClick={() => doCopy(toText(bom, title), t('A lista', 'The list'))}>
          {t('Másolás szövegként', 'Copy as text')}
        </button>
        <button type="button" className="btn btn-small" onClick={() => doCopy(toTsv(table), t('A táblázat', 'The table'), toHtmlTable(table))}>
          {t('Másolás táblázatként (Excel)', 'Copy as table (Excel)')}
        </button>
        <button type="button" className="btn btn-small" onClick={() => downloadText(`${fileBase}.csv`, toCsv(table), 'text/csv;charset=utf-8')}>
          CSV
        </button>
        <button type="button" className="btn btn-small" onClick={xlsx}>
          XLSX
        </button>
        {canShare && (
          <button type="button" className="btn btn-small" onClick={share}>
            {t('Megosztás', 'Share')}
          </button>
        )}
        <span className="toast" role="status">
          {toast}
        </span>
      </div>

      {bom.rows.length === 0 ? (
        <p className="empty lv-empty">
          {status
            ? t(`Nincs „${STATUS_LABEL[status]}” státuszú tő.`, `No plants with status “${STATUS_LABEL[status]}”.`)
            : t('Még nincs növény a tervben. Helyezz el néhányat a Növény, Folt vagy Sor eszközzel.', 'No plants in the plan yet. Place some with the Plant, Drift or Row tool.')}
        </p>
      ) : (
        <div className="tw">
          <table className="bom">
            <thead>
              <tr>
                <th>{t('Növény', 'Plant')}</th>
                {perArea && bom.areas.map((a) => <th key={a.id} className="m">{a.name}</th>)}
                <th className="m">{t('Ültetés', 'Plant')}</th>
                <th className="m">{t('Rendelés', 'Order')}</th>
                <th>{t('Kiszerelés', 'Pot size')}</th>
                <th className="m">Max.</th>
                <th className="m">{t('Tőtáv', 'Spacing')}</th>
                <th>{t('Víz', 'Water')}</th>
                <th>Juglone</th>
                <th className="m">{t('Egységár', 'Unit price')}</th>
                <th className="m">{t('Részösszeg', 'Subtotal')}</th>
                <th>{t('Státusz', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {bom.rows.map((r) => (
                <tr key={r.plant.code}>
                  <td>
                    <span className="bom-name">
                      <PlantChip p={r.plant} size={28} />
                      <span>
                        {plantName(r.plant)}
                        {r.plant.isTree ? t(' (fa)', ' (tree)') : ''}
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
                    <span className={`tag${r.plant.priceSource === 'shop' ? ' s' : ''}`}>{r.plant.priceSource === 'shop' ? t('bolt', 'shop') : t('becsl.', 'est.')}</span>
                  </td>
                  <td className="m">{fmtInt(r.subtotal)}</td>
                  <td>
                    <StatusCell
                      counts={r.byStatus}
                      onSet={(s) => useProject.getState().setSpeciesStatus(r.plant.code, s, areaIds, status)}
                      label={plantName(r.plant)}
                    />
                  </td>
                </tr>
              ))}
              <tr className="tot">
                <td>{t('Összesen', 'Total')}</td>
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
        <span>{t('Tartalék szövegmező: ha a másolás gomb nem működik, jelöld ki és másold innen', 'Fallback text box: if the copy button does not work, select and copy from here')}</span>
        <textarea ref={taRef} readOnly rows={6} value={fallback || toText(bom, title)} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
      </label>
      <p className="mono muted lv-note">
        {t(
          `A rendelendő mennyiség az ültetett darabszám + ${bom.reservePct}%, felfelé kerekítve; a fáknál nincs tartalék. Az árak bruttó becslések (K-08), vásárlás előtt ellenőrizd.`,
          `The order is the planted count + ${bom.reservePct}%, rounded up; trees get no spare. Prices are gross estimates (K-08) – check them before buying.`,
        )}
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
      <select value="" onChange={(e) => e.target.value && onSet(e.target.value as ItemStatus)} aria-label={t(`${label} státusza`, `${label} status`)}>
        <option value="">{t('mind →', 'all →')}</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </span>
  );
}
