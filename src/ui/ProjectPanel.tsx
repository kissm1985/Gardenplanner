import { useRef, useState } from 'react';
import { bomFromEntries } from '../engine/bom';
import { exportJson, parseProject, shareUrl } from '../engine/io';
import { SEASON_LABEL, SEASON_MONTH, type Season } from '../engine/season';
import { buildVisualPrompt, type Lang, type Viewpoint } from '../engine/visualPrompt';
import { activeVariant, migrate, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { copy } from './clipboard';
import { downloadBlob, downloadText } from './download';
import { planSvg, svgToPng, type LegendRow } from './exportImage';

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
  const [withLegend, setWithLegend] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLTextAreaElement>(null);
  const vizRef = useRef<HTMLTextAreaElement>(null);
  const [viz, setViz] = useState<{ season: Season; viewpoint: Viewpoint; lang: Lang; mature: boolean }>({ season: 1, viewpoint: 'eye', lang: 'hu', mature: true });
  const [vizText, setVizText] = useState('');
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

  const image = async (kind: 'png' | 'svg', opts: { month?: number | null; legend?: boolean; suffix?: string } = {}) => {
    if (!area) return;
    const v = activeVariant(area);
    const legend: LegendRow[] = (opts.legend ?? withLegend)
      ? bomFromEntries([{ area, items: v.items }], project.plantDb, project.settings.reservePct).rows.map((r) => ({
          code: r.plant.code,
          nameHu: r.plant.nameHu,
          nameLat: r.plant.nameLat,
          color: r.plant.color,
          symbol: r.plant.symbol,
          count: r.planted,
        }))
      : [];
    const svg = planSvg({ area, items: v.items, plantDb: project.plantDb, month: opts.month !== undefined ? opts.month : month, legend, caption: `${area.name} – ${v.name} · ${area.widthCm} × ${area.lengthCm} cm` });
    const name = `${slug(area.name)}-${slug(v.name)}${opts.suffix ?? ''}`;
    try {
      if (kind === 'svg') downloadText(`${name}.svg`, svg, 'image/svg+xml');
      else downloadBlob(`${name}.png`, await svgToPng(svg), 'image/png');
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const vizPrompt = async () => {
    if (!area) return;
    const text = buildVisualPrompt(project, area, activeVariant(area).items, viz);
    setVizText(text);
    await new Promise((r) => setTimeout(r));
    const ok = await copy(text, vizRef.current);
    setMsg(ok ? 'A szöveg kimásolva. Illeszd be a ChatGPT-be, és csatold mellé a PNG-t.' : 'Jelöld ki és másold ki a szöveget a mezőből.');
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
        <label className="check">
          <input type="checkbox" checked={withLegend} onChange={(e) => setWithLegend(e.target.checked)} />
          <span>Jelmagyarázattal (kód → növény, darabszám)</span>
        </label>
        <p className="mono muted">{month ? 'Az évszaknézet színeivel.' : 'A szerkesztett változat, alapszínekkel. Évszaknézetből az adott hónap színeit kapod.'}</p>
      </fieldset>

      <fieldset className="field-group">
        <legend>Látványterv ChatGPT-nek{area ? ` – ${area.name}` : ''}</legend>
        <p className="mono muted">Egy bemásolható leírás (méretek, égtáj, fal, gyep, a foltok helye méterben, minden faj színe, formája, magassága) és mellé a rajz jelmagyarázattal. A kettőt együtt add be a ChatGPT-nek.</p>
        <div className="field-row">
          <label className="field">
            <span className="lbl">Évszak</span>
            <select value={viz.season} onChange={(e) => setViz({ ...viz, season: +e.target.value as Season })}>
              {SEASON_LABEL.map((l, i) => (
                <option key={l} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lbl">Nézőpont</span>
            <select value={viz.viewpoint} onChange={(e) => setViz({ ...viz, viewpoint: e.target.value as Viewpoint })}>
              <option value="eye">szemmagasságból</option>
              <option value="aerial">madártávlatból</option>
              <option value="both">mindkettő</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="lbl">Nyelv</span>
            <select value={viz.lang} onChange={(e) => setViz({ ...viz, lang: e.target.value as Lang })}>
              <option value="hu">magyar</option>
              <option value="en">angol</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={viz.mature} onChange={(e) => setViz({ ...viz, mature: e.target.checked })} />
            <span>Kifejlett állapot (2–3 év múlva)</span>
          </label>
        </div>
        <div className="form-actions form-actions-start">
          <button type="button" className="btn btn-small btn-primary" onClick={vizPrompt} disabled={!area}>
            Leírás másolása
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => image('png', { month: SEASON_MONTH[viz.season], legend: true, suffix: '-latvanyterv' })}
            disabled={!area}
          >
            Rajz PNG-ben
          </button>
        </div>
        {vizText && <textarea ref={vizRef} className="sched-text" readOnly rows={8} value={vizText} onFocus={(e) => e.currentTarget.select()} aria-label="Leírás a látványtervhez" />}
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
