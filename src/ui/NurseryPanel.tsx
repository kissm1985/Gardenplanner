// Pro tier: connecting a nursery's catalogue (PL-BE-04). The nursery publishes its species, pot sizes, prices and
// stock on its Planterra server; the app keeps a copy on the device and puts the prices into the plant list.
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { cachedCatalog, defaultServer, getConnection, normalizeServer, setConnection, syncCatalog } from '../engine/catalogSync';
import { SLUG_RE } from '../engine/catalog';
import { mergeCatalog, type MergeResult, type NurseryCatalog } from '../model/nursery';
import { useFeature } from '../model/tier';
import { seedByCode } from '../store/projectModel';
import { useProject } from '../store/projectStore';
import { FeatureButton } from './Locked';

/** Merges the catalogue into the open project; returns what changed. */
export function applyCatalog(cat: NurseryCatalog): MergeResult | null {
  const { project, setPlantDb } = useProject.getState();
  if (!project) return null;
  const r = mergeCatalog(project, cat, seedByCode);
  if (r.added.length || r.updated.length) setPlantDb(r.plantDb);
  return r;
}

/** Brings the catalogue up to date at start-up (Pro tier, connected), quietly; offline the cached copy is used. */
export async function syncAtStart() {
  const c = getConnection();
  if (!c) return;
  const cat = await syncCatalog(c)
    .then((r) => r.catalog)
    .catch(() => cachedCatalog());
  if (cat) applyCatalog(cat);
}

export function NurseryPanel() {
  const ok = useFeature('nurseryCatalog');
  const [conn, setConn] = useState(getConnection);
  const [server, setServer] = useState(conn?.server ?? '');
  const [tenant, setTenant] = useState(conn?.tenant ?? '');
  const [cat, setCat] = useState<NurseryCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState<MergeResult | null>(null);
  useEffect(() => {
    void cachedCatalog().then(setCat);
  }, []);
  if (!ok)
    return (
      <FeatureButton feature="nurseryCatalog" onClick={() => {}}>
        {t('Kertészeti katalógus és árak (Profi)', 'Nursery catalogue and prices (Pro)')}
      </FeatureButton>
    );

  const sync = async (c = conn) => {
    if (!c) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await syncCatalog(c);
      setCat(r.catalog);
      setResult(applyCatalog(r.catalog));
      setMsg(
        r.changed
          ? t(`Frissítve: ${r.catalog.version}. változat, ${r.changed} változás.`, `Updated: version ${r.catalog.version}, ${r.changed} changes.`)
          : t(`A katalógus naprakész (${r.catalog.version}. változat).`, `The catalogue is up to date (version ${r.catalog.version}).`),
      );
    } catch (e) {
      const cached = await cachedCatalog();
      if (cached) setResult(applyCatalog(cached));
      setMsg(
        t(`Nem sikerült frissíteni (${(e as Error).message}). `, `Could not update (${(e as Error).message}). `) +
          (cached ? t('A készüléken tárolt példányt használom.', 'Using the copy on this device.') : ''),
      );
    } finally {
      setBusy(false);
    }
  };

  const connect = () => {
    const s = normalizeServer(server);
    const slug = tenant.trim().toLowerCase();
    if (s === null) return setMsg(t('A szerver címe https:// kezdetű legyen.', 'The server address must start with https://.'));
    if (!SLUG_RE.test(slug)) return setMsg(t('A kertészet azonosítója 3–40 kisbetű, szám vagy kötőjel.', 'The nursery id is 3–40 lower-case letters, digits or hyphens.'));
    const c = { server: s, tenant: slug };
    setConnection(c);
    setConn(c);
    void sync(c);
  };

  const n = cat ? Object.keys(cat.species).length : 0;
  return (
    <fieldset className="field-group nursery-panel">
      <legend>{t('Kertészeti katalógus', 'Nursery catalogue')}</legend>
      {conn && cat ? (
        <p>
          <b>{cat.name}</b> · {t(`${n} faj, ${cat.version}. változat`, `${n} species, version ${cat.version}`)} ·{' '}
          <span className="muted">{t(`frissítve: ${cat.syncedAt.slice(0, 16).replace('T', ' ')}`, `updated: ${cat.syncedAt.slice(0, 16).replace('T', ' ')}`)}</span>
        </p>
      ) : (
        <p className="muted">
          {t(
            'Kapcsold össze a tervezőt a kertészet katalógusával: a fajok, cserépméretek, árak és a készlet bekerülnek a növénylistába, és a lista a kertészet áraival számol.',
            'Connect to a nursery’s catalogue: its species, pot sizes, prices and stock go into the plant list, and the list uses the nursery’s prices.',
          )}
        </p>
      )}
      <label className="field">
        <span>{t('Kertészet azonosítója', 'Nursery id')}</span>
        <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="pl. zoldkert" autoCapitalize="none" spellCheck={false} />
      </label>
      <details>
        <summary>{t('Szerver', 'Server')}</summary>
        <label className="field">
          <span>{t('Szerver címe (üresen: alapértelmezett)', 'Server address (empty: default)')}</span>
          <input value={server} onChange={(e) => setServer(e.target.value)} placeholder={defaultServer()} inputMode="url" spellCheck={false} />
        </label>
      </details>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={connect}>
          {conn ? t('Frissítés', 'Update') : t('Kapcsolódás', 'Connect')}
        </button>
        {conn && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setConnection(null);
              setConn(null);
              setCat(null);
              setResult(null);
              setMsg(
                t(
                  'A kapcsolat megszűnt. A növénylistában lévő árak maradnak, amíg át nem írod őket.',
                  'Disconnected. Prices already in the plant list stay until you change them.',
                ),
              );
            }}
          >
            {t('Leválasztás', 'Disconnect')}
          </button>
        )}
      </div>
      {msg && (
        <p className="mono" role="status">
          {msg}
        </p>
      )}
      {result && (result.added.length > 0 || result.updated.length > 0) && (
        <p className="mono muted">
          {t(
            `Új faj a listában: ${result.added.length}; frissített ár/készlet: ${result.updated.length}.`,
            `New species in the list: ${result.added.length}; price/stock updated: ${result.updated.length}.`,
          )}
        </p>
      )}
      {result && result.gone.length > 0 && (
        <div className="warn-box" role="alert">
          <b>{t('A kertészet már nem kínálja:', 'The nursery no longer offers:')}</b>
          <ul>
            {result.gone.map((g) => (
              <li key={g.code}>
                {g.code} {g.name} – {t(`${g.placed} tő a tervben`, `${g.placed} plants in the plan`)}
              </li>
            ))}
          </ul>
          <small>{t('Cseréld le őket (Csere), vagy kérdezd meg a kertészetet.', 'Replace them (Replace) or ask the nursery.')}</small>
        </div>
      )}
    </fieldset>
  );
}
