import { useRef, useState } from 'react';
import { exportJson, parseProject, shareUrl } from '../engine/io';
import { activeVariant, migrate, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { copy } from './clipboard';
import { downloadBlob, downloadText } from './download';
import { planSvg, svgToPng } from './exportImage';

export type Orientation = 'portrait' | 'landscape';

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');

/** Project menu: name, backup/restore, share link, images, print, intro. */
export function ProjectPanel({ onPrint, onIntro, onDone }: { onPrint: (o: Orientation) => void; onIntro: () => void; onDone: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [orient, setOrient] = useState<Orientation>('portrait');
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLTextAreaElement>(null);
  const month = useUi((s) => (s.tool === 'season' ? s.month : null));

  const load = async (file: File) => {
    try {
      const p = migrate(parseProject(await file.text()));
      if (!confirm(`Betöltöd a(z) „${p.name}” projektet (${p.areas.length} terület)? A mostani terv helyére kerül – előtte érdemes elmenteni.`)) return;
      useProject.getState().setLoaded(p);
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const image = async (kind: 'png' | 'svg') => {
    if (!area) return;
    const v = activeVariant(area);
    const svg = planSvg({ area, items: v.items, plantDb: project.plantDb, month, caption: `${area.name} – ${v.name} · ${area.widthCm} × ${area.lengthCm} cm` });
    const name = `${slug(area.name)}-${slug(v.name)}`;
    try {
      if (kind === 'svg') downloadText(`${name}.svg`, svg, 'image/svg+xml');
      else downloadBlob(`${name}.png`, await svgToPng(svg), 'image/png');
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const makeLink = async () => {
    const url = shareUrl(project);
    setLink(url);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${project.name} – kerterv`, url });
        return;
      } catch {
        /* fall back to copy */
      }
    }
    const ok = await copy(url, linkRef.current);
    setMsg(ok ? 'A link kimásolva. Telefonon is megnyitható, csak olvasható.' : 'Jelöld ki és másold ki a linket a mezőből.');
  };

  return (
    <div className="form">
      <label className="field">
        <span>Projekt neve</span>
        <input defaultValue={project.name} onBlur={(e) => useProject.getState().renameProject(e.target.value)} />
      </label>

      <fieldset className="field-group">
        <legend>Mentés és visszatöltés</legend>
        <div className="form-actions form-actions-start">
          <button type="button" className="btn btn-small" onClick={() => downloadText(`kerttervezo-${slug(project.name)}-${today()}.json`, exportJson(project), 'application/json')}>
            Teljes mentés (JSON)
          </button>
          <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
            Betöltés JSON-ból
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f);
              e.target.value = '';
            }}
          />
        </div>
        <p className="mono muted">Minden adat ezen a készüléken van; a JSON-mentéssel viheted át másik eszközre.</p>
      </fieldset>

      <fieldset className="field-group">
        <legend>Megosztás</legend>
        <button type="button" className="btn btn-small" onClick={makeLink}>
          Csak olvasható link
        </button>
        {link && <textarea ref={linkRef} className="sched-text" readOnly rows={3} value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Megosztható link" />}
        <p className="mono muted">A terv a link végében, kódolva utazik – nincs szerver. A választott változatokat mutatja.</p>
      </fieldset>

      <fieldset className="field-group">
        <legend>Kép a rajzról{area ? ` – ${area.name}` : ''}</legend>
        <div className="form-actions form-actions-start">
          <button type="button" className="btn btn-small" onClick={() => image('png')} disabled={!area}>
            PNG
          </button>
          <button type="button" className="btn btn-small" onClick={() => image('svg')} disabled={!area}>
            SVG
          </button>
        </div>
        <p className="mono muted">{month ? 'Az évszaknézet színeivel.' : 'A szerkesztett változat, alapszínekkel. Évszaknézetből az adott hónap színeit kapod.'}</p>
      </fieldset>

      <fieldset className="field-group">
        <legend>Nyomtatás / PDF (A4)</legend>
        <div className="seg">
          <label className="seg-item">
            <input type="radio" name="orient" checked={orient === 'portrait'} onChange={() => setOrient('portrait')} />
            <span>álló</span>
          </label>
          <label className="seg-item">
            <input type="radio" name="orient" checked={orient === 'landscape'} onChange={() => setOrient('landscape')} />
            <span>fekvő</span>
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onPrint(orient)}>
          Nyomtatás / mentés PDF-be
        </button>
        <p className="mono muted">Területenként egy oldal: felülnézet, négy évszak, növénylista, figyelmeztetések. A választott változatokból.</p>
      </fieldset>

      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-small" onClick={onIntro}>
          Bevezető újra
        </button>
      </div>
      {msg && (
        <p className="toast" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
