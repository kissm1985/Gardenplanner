// "Make a visualisation" (spec v0.2 F1): the plan on the drawing as a 3D aerial view, computed from the plan data
// in the browser (no AI image generator), with PNG, PDF and manifest downloads. Three.js loads only on the first tap.
import { useState } from 'react';
import { t } from '../i18n';
import { localName } from '../i18n/names';
import { activeVariant, selectCurrentArea, useProject } from '../store/projectStore';
import { downloadBlob, downloadText } from './download';

type Done = { png: string; pdf: () => Promise<Uint8Array>; manifest: string; n: number; species: number; name: string };

/** data: URL → bytes, without fetch (the app's CSP does not allow fetching data: URLs). */
function dataUrlBytes(u: string): Uint8Array {
  const bin = atob(u.slice(u.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

export function Render3DPanel() {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [msg, setMsg] = useState('');
  if (!area) return null;
  const v = activeVariant(area);

  const make = async () => {
    setBusy(true);
    setMsg('');
    try {
      const [{ renderPlan }, { renderPdf }] = await Promise.all([import('../render3d/render'), import('../render3d/pdf')]);
      // Let the "working" state paint before the (synchronous) render.
      await new Promise((r) => setTimeout(r, 30));
      const name = localName(area.name);
      const r = renderPlan(area, project.plantDb, v.items, { project: slug(localName(project.name)) || 'planterra', title: `${name} – ${localName(v.name)}` });
      setDone({
        png: r.png,
        manifest: JSON.stringify(r.manifest, null, 2),
        n: r.instances.length,
        species: new Set(r.instances.map((p) => p.species_id)).size,
        name,
        pdf: () => renderPdf(r.png, r.manifest, { title: `${name} – ${localName(v.name)}`, project: localName(project.name) }),
      });
    } catch (e) {
      setMsg(t(`Nem sikerült a látványterv: ${(e as Error).message}`, `Could not make the visualisation: ${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };

  const base = done ? `latvanyterv-${slug(done.name) || 'terv'}` : '';
  return (
    <fieldset className="field-group render3d">
      <legend>{t('3D látványterv a tervből', '3D visualisation from the plan')}</legend>
      <p className="mono muted">
        {t(
          'A rajzon látható változat légi nézetben, a terv adataiból számolva: minden növény a helyén, fajonként saját formával és színnel. Nem fotó és nem AI-kép.',
          'The variant on the drawing as an aerial view, computed from the plan data: every plant in its place, each species with its own form and colour. Not a photo, not an AI image.',
        )}
      </p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={make}>
        {busy ? t('Készül…', 'Working…') : done ? t('Látványterv újra', 'Make it again') : t('Látványterv készítése', 'Make the visualisation')}
      </button>
      {msg && (
        <p className="warn-text" role="alert">
          {msg}
        </p>
      )}
      {done && (
        <>
          <img className="render3d-preview" src={done.png} alt={t(`Látványterv: ${done.name}`, `Visualisation: ${done.name}`)} />
          <p className="mono muted">{t(`${done.n} növény, ${done.species} faj`, `${done.n} plants, ${done.species} species`)}</p>
          <div className="form-actions form-actions-start">
            <button type="button" className="btn btn-small" onClick={() => downloadBlob(`${base}.png`, dataUrlBytes(done.png), 'image/png')}>
              PNG
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={async () => {
                try {
                  downloadBlob(`${base}.pdf`, new Blob([(await done.pdf()) as BlobPart], { type: 'application/pdf' }), 'application/pdf');
                } catch (e) {
                  setMsg(t(`A PDF nem készült el: ${(e as Error).message}`, `The PDF failed: ${(e as Error).message}`));
                }
              }}
            >
              PDF
            </button>
            <button type="button" className="btn btn-small" onClick={() => downloadText(`${base}-manifest.json`, done.manifest, 'application/json')}>
              manifest.json
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}
