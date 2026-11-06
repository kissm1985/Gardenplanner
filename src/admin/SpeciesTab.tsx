// The draft catalogue: species with their pot sizes, prices and stock. Changes become visible to the planners only
// after publishing.
import { useMemo, useState } from 'react';
import { t } from '../i18n';
import { type CatalogSpecies, type Offer, validateSpecies } from '../engine/catalog';
import type { Client, SpeciesList } from './adminApi';

const EMPTY: CatalogSpecies = { code: '', nameHu: '', nameLat: '', offers: [{ pot: 'P9', priceHuf: 0 }] };

export function SpeciesTab({ api, data, canEdit, reload }: { api: Client; data: SpeciesList; canEdit: boolean; reload: () => void }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ s: CatalogSpecies; isNew: boolean } | null>(null);
  const pending = new Set([...data.pending.added, ...data.pending.changed]);
  const list = useMemo(() => {
    const f = q.trim().toLowerCase();
    return data.species.filter((s) => !f || `${s.code} ${s.nameHu} ${s.nameLat} ${s.nameEn ?? ''}`.toLowerCase().includes(f));
  }, [data.species, q]);

  if (edit) return <SpeciesEditor api={api} start={edit.s} isNew={edit.isNew} onDone={() => (setEdit(null), reload())} onCancel={() => setEdit(null)} />;
  return (
    <section>
      <div className="form-actions form-actions-start">
        <input className="admin-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Keresés név vagy kód szerint', 'Search by name or code')} />
        {canEdit && (
          <button type="button" className="btn btn-primary btn-small" onClick={() => setEdit({ s: EMPTY, isNew: true })}>
            {t('Új faj', 'New species')}
          </button>
        )}
      </div>
      <p className="muted">{t(`${data.species.length} faj a piszkozatban.`, `${data.species.length} species in the draft.`)}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('Kód', 'Code')}</th>
            <th>{t('Név', 'Name')}</th>
            <th>{t('Cserép: ár (készlet)', 'Pot: price (stock)')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.code}>
              <td className="mono">
                {s.code}
                {pending.has(s.code) && (
                  <span className="admin-tag" title={t('Még nincs közzétéve', 'Not published yet')}>
                    *
                  </span>
                )}
              </td>
              <td>
                {s.nameHu}
                <br />
                <i className="muted">{s.nameLat}</i>
              </td>
              <td>
                {s.offers.map((o) => (
                  <div key={o.pot} className="mono">
                    {o.pot}: {o.priceHuf.toLocaleString('hu-HU')} Ft{o.stock != null ? ` (${o.stock})` : ''}
                  </div>
                ))}
              </td>
              <td>
                <button type="button" className="btn btn-small" onClick={() => setEdit({ s, isNew: false })}>
                  {canEdit ? t('Szerkesztés', 'Edit') : t('Megnyitás', 'Open')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SpeciesEditor({ api, start, isNew, onDone, onCancel }: { api: Client; start: CatalogSpecies; isNew: boolean; onDone: () => void; onCancel: () => void }) {
  const [s, setS] = useState<CatalogSpecies>(start);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof CatalogSpecies>(k: K, v: CatalogSpecies[K]) => setS((x) => ({ ...x, [k]: v }));
  const setOffer = (i: number, patch: Partial<Record<keyof Offer, string>>) =>
    setS((x) => ({
      ...x,
      offers: x.offers.map((o, j) =>
        j !== i
          ? o
          : {
              ...o,
              ...(patch.pot != null ? { pot: patch.pot } : {}),
              ...(patch.priceHuf != null ? { priceHuf: Number(patch.priceHuf) } : {}),
              ...(patch.stock != null ? { stock: patch.stock === '' ? undefined : Number(patch.stock) } : {}),
            },
      ),
    }));
  const num = (v: string) => (v === '' ? undefined : Number(v));

  const save = async () => {
    const v = validateSpecies(s);
    if (!v.ok) return setErrors(v.errors);
    try {
      await api.putSpecies(v.value);
      onDone();
    } catch (e) {
      const d = (e as { body?: { details?: string[] } }).body?.details;
      setErrors(d ?? [(e as Error).message]);
    }
  };
  const remove = async () => {
    if (!confirm(t(`Törlöd: ${s.nameHu}? A közzétételig a tervezők még látják.`, `Delete ${s.nameHu}? Planners still see it until you publish.`))) return;
    await api.deleteSpecies(s.code);
    onDone();
  };

  return (
    <section className="form admin-editor">
      <h2>{isNew ? t('Új faj', 'New species') : `${s.code} – ${s.nameHu}`}</h2>
      <div className="admin-grid">
        <label className="field">
          <span>{t('Kód (2–6 betű/szám)', 'Code (2–6 letters/digits)')}</span>
          <input value={s.code} disabled={!isNew} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={6} />
        </label>
        <label className="field">
          <span>{t('Magyar név', 'Hungarian name')}</span>
          <input value={s.nameHu} onChange={(e) => set('nameHu', e.target.value)} maxLength={80} />
        </label>
        <label className="field">
          <span>{t('Latin név', 'Latin name')}</span>
          <input value={s.nameLat} onChange={(e) => set('nameLat', e.target.value)} maxLength={100} />
        </label>
        <label className="field">
          <span>{t('Angol név', 'English name')}</span>
          <input value={s.nameEn ?? ''} onChange={(e) => set('nameEn', e.target.value || undefined)} maxLength={80} />
        </label>
        <label className="field">
          <span>{t('Magasság (cm)', 'Height (cm)')}</span>
          <input type="number" min={1} value={s.maxHeightCm ?? ''} onChange={(e) => set('maxHeightCm', num(e.target.value))} />
        </label>
        <label className="field">
          <span>{t('Szélesség (cm)', 'Spread (cm)')}</span>
          <input type="number" min={1} value={s.spreadCm ?? ''} onChange={(e) => set('spreadCm', num(e.target.value))} />
        </label>
      </div>
      <label className="field">
        <span>{t('Megjegyzés', 'Notes')}</span>
        <textarea value={s.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} maxLength={500} rows={2} />
      </label>
      <fieldset className="field-group">
        <legend>{t('Cserépméretek, árak, készlet', 'Pot sizes, prices, stock')}</legend>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('Cserép / méret', 'Pot / size')}</th>
              <th>{t('Ár (Ft)', 'Price (HUF)')}</th>
              <th>{t('Készlet (db)', 'Stock')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.offers.map((o, i) => (
              <tr key={i}>
                <td>
                  <input aria-label={t('Cserép', 'Pot')} value={o.pot} onChange={(e) => setOffer(i, { pot: e.target.value })} maxLength={20} />
                </td>
                <td>
                  <input aria-label={t('Ár', 'Price')} type="number" min={0} value={o.priceHuf} onChange={(e) => setOffer(i, { priceHuf: e.target.value })} />
                </td>
                <td>
                  <input aria-label={t('Készlet', 'Stock')} type="number" min={0} value={o.stock ?? ''} onChange={(e) => setOffer(i, { stock: e.target.value })} />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-small"
                    aria-label={t('Sor törlése', 'Remove row')}
                    onClick={() =>
                      set(
                        'offers',
                        s.offers.filter((_, j) => j !== i),
                      )
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-small" onClick={() => set('offers', [...s.offers, { pot: '', priceHuf: 0 }])}>
          {t('+ cserépméret', '+ pot size')}
        </button>
      </fieldset>
      {errors.length > 0 && (
        <ul className="warn-box" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-primary" onClick={save}>
          {t('Mentés', 'Save')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('Mégse', 'Cancel')}
        </button>
        {!isNew && (
          <button type="button" className="btn btn-danger" onClick={remove}>
            {t('Törlés', 'Delete')}
          </button>
        )}
      </div>
    </section>
  );
}
