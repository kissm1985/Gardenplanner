// Price list import (PL-BE-03): CSV or XLSX → column mapping → preview with row errors → apply to the draft.
import { useState } from 'react';
import { t } from '../i18n';
import { type ImportField, IMPORT_FIELDS, type ImportMapping, parseCsvText } from '../engine/catalog';
import { readXlsx } from '../engine/xlsxRead';
import type { Client, ImportPreview } from './adminApi';

const FIELD: Record<ImportField, () => string> = {
  code: () => t('Kód', 'Code'),
  nameHu: () => t('Magyar név', 'Hungarian name'),
  nameLat: () => t('Latin név', 'Latin name'),
  nameEn: () => t('Angol név', 'English name'),
  pot: () => t('Cserép / méret', 'Pot / size'),
  priceHuf: () => t('Ár (Ft)', 'Price (HUF)'),
  stock: () => t('Készlet', 'Stock'),
};
const STATUS: Record<string, () => string> = {
  new: () => t('új', 'new'),
  update: () => t('változik', 'changes'),
  same: () => t('változatlan', 'unchanged'),
  error: () => t('hiba', 'error'),
};

export function ImportTab({ api, onDone }: { api: Client; onDone: () => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [file, setFile] = useState('');
  const [mapping, setMapping] = useState<ImportMapping | undefined>();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [msg, setMsg] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);

  const run = async (r: string[][], m?: ImportMapping) => {
    setMsg('');
    try {
      const p = await api.preview(r, m);
      setPreview(p);
      setMapping(p.mapping);
    } catch (e) {
      setPreview(null);
      const b = (e as { body?: { mapping?: ImportMapping } }).body;
      if (b?.mapping) setMapping(b.mapping);
      setMsg((e as Error).message);
    }
  };

  const load = async (f: File) => {
    setFile(f.name);
    try {
      const r = /\.xlsx$/i.test(f.name) ? readXlsx(new Uint8Array(await f.arrayBuffer())) : parseCsvText(await f.text());
      setRows(r);
      setMapping(undefined);
      await run(r);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const commit = async () => {
    if (!rows) return;
    try {
      const r = await api.commit(rows, mapping);
      setMsg(
        t(
          `Kész: ${r.species} faj frissült a piszkozatban. Közzététel után látják a tervezők.`,
          `Done: ${r.species} species updated in the draft. Planners see it after publishing.`,
        ),
      );
      setRows(null);
      setPreview(null);
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const header = rows?.[0] ?? [];
  const shown = preview ? preview.rows.filter((r) => !onlyErrors || r.status === 'error') : [];
  return (
    <section className="form">
      <p className="muted">
        {t(
          'Tölts fel árlistát CSV- vagy XLSX-fájlban. Oszlopok: kód, cserép, ár, és ha van: készlet, magyar és latin név (új fajhoz kötelező). Az első sor a fejléc.',
          'Upload a price list as CSV or XLSX. Columns: code, pot, price, and if you have them: stock, Hungarian and Latin name (required for new species). The first row is the header.',
        )}
      </p>
      <label className="btn btn-small admin-file">
        {t('Fájl kiválasztása', 'Choose file')}
        <input
          type="file"
          accept=".csv,.txt,.xlsx,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void load(f);
          }}
        />
      </label>
      {file && <span className="mono"> {file}</span>}
      {rows && (
        <fieldset className="field-group">
          <legend>{t('Oszlopok', 'Columns')}</legend>
          <div className="admin-grid">
            {IMPORT_FIELDS.map((f) => (
              <label key={f} className="field">
                <span>{FIELD[f]()}</span>
                <select
                  value={mapping?.[f] ?? ''}
                  onChange={(e) => {
                    const m = { ...mapping, [f]: e.target.value === '' ? undefined : Number(e.target.value) };
                    setMapping(m);
                    void run(rows, m);
                  }}
                >
                  <option value="">–</option>
                  {header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `#${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {preview && (
        <>
          <p className="admin-summary" role="status">
            {(['new', 'update', 'same', 'error'] as const).map((k) => (
              <span key={k} className={`admin-status is-${k}`}>
                {STATUS[k]()}: {preview.summary[k]}
              </span>
            ))}
          </p>
          <label className="check">
            <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> {t('Csak a hibás sorok', 'Only rows with errors')}
          </label>
          <div className="admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('Sor', 'Row')}</th>
                  <th>{t('Kód', 'Code')}</th>
                  <th>{t('Cserép', 'Pot')}</th>
                  <th>{t('Ár', 'Price')}</th>
                  <th>{t('Készlet', 'Stock')}</th>
                  <th>{t('Eredmény', 'Result')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 500).map((r) => (
                  <tr key={r.line} className={`is-${r.status}`}>
                    <td className="mono">{r.line}</td>
                    <td className="mono">{r.code}</td>
                    <td>{r.offer?.pot}</td>
                    <td className="mono">{r.offer?.priceHuf}</td>
                    <td className="mono">{r.offer?.stock}</td>
                    <td>
                      <span className={`admin-status is-${r.status}`}>{STATUS[r.status ?? 'error']()}</span>
                      {r.errors.map((e) => (
                        <div key={e} className="warn-text">
                          {e}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions form-actions-start">
            <button type="button" className="btn btn-primary" disabled={!preview.summary.new && !preview.summary.update} onClick={commit}>
              {t(`Alkalmazás (${preview.summary.new + preview.summary.update} sor)`, `Apply (${preview.summary.new + preview.summary.update} rows)`)}
            </button>
            {preview.summary.error > 0 && <span className="muted">{t('A hibás sorok kimaradnak.', 'Rows with errors are skipped.')}</span>}
          </div>
        </>
      )}
      {msg && (
        <p className="mono" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
