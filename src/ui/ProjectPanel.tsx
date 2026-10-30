import { useRef, useState } from 'react';
import { About } from './About';
import { bomFromEntries } from '../engine/bom';
import { exportJson, parseProject, shareUrl } from '../engine/io';
import { activeVariant, migrate, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { copy } from './clipboard';
import { downloadBlob, downloadText } from './download';
import { planSvg, svgToPng, type LegendRow } from './exportImage';
import { t } from '../i18n';
import { plantName } from '../model/plants';

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
export function ProjectPanel({ onPrint, onIntro, onDone, onVisual }: { onPrint: (o: Orientation) => void; onIntro: () => void; onDone: () => void; onVisual: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [orient, setOrient] = useState<Orientation>('portrait');
  const [withLegend, setWithLegend] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLTextAreaElement>(null);
  const month = useUi((s) => (s.tool === 'season' ? s.month : null));

  const load = async (file: File) => {
    try {
      const p = migrate(parseProject(await file.text()));
      if (
        !confirm(
          t(
            `Betöltöd a(z) „${p.name}” projektet (${p.areas.length} terület)? A mostani terv helyére kerül – előtte érdemes elmenteni.`,
            `Load the project “${p.name}” (${p.areas.length} areas)? It replaces the current plan – save that first.`,
          ),
        )
      )
        return;
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
          nameHu: plantName(r.plant),
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

  const makeLink = async () => {
    const url = shareUrl(project);
    setLink(url);
    if (navigator.share) {
      try {
        await navigator.share({ title: t(`${project.name} – kerterv`, `${project.name} – garden plan`), url });
        return;
      } catch {
        /* fall back to copy */
      }
    }
    const ok = await copy(url, linkRef.current);
    setMsg(
      ok
        ? t('A link kimásolva. Telefonon is megnyitható, csak olvasható.', 'Link copied. It opens on phones too, read-only.')
        : t('Jelöld ki és másold ki a linket a mezőből.', 'Select and copy the link from the box.'),
    );
  };

  return (
    <div className="form">
      <label className="field">
        <span>{t('Projekt neve', 'Project name')}</span>
        <input defaultValue={project.name} onBlur={(e) => useProject.getState().renameProject(e.target.value)} />
      </label>

      <fieldset className="field-group">
        <legend>{t('Mentés és visszatöltés', 'Save and restore')}</legend>
        <div className="form-actions form-actions-start">
          <button type="button" className="btn btn-small" onClick={() => downloadText(`gardenly-${slug(project.name)}-${today()}.json`, exportJson(project), 'application/json')}>
            {t('Teljes mentés (JSON)', 'Full backup (JSON)')}
          </button>
          <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
            {t('Betöltés JSON-ból', 'Load from JSON')}
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
        <p className="mono muted">{t('Minden adat ezen a készüléken van; a JSON-mentéssel viheted át másik eszközre.', 'All data is on this device; move it to another one with the JSON backup.')}</p>
      </fieldset>

      <fieldset className="field-group">
        <legend>{t('Megosztás', 'Sharing')}</legend>
        <button type="button" className="btn btn-small" onClick={makeLink}>
          {t('Csak olvasható link', 'Read-only link')}
        </button>
        {link && <textarea ref={linkRef} className="sched-text" readOnly rows={3} value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t('Megosztható link', 'Shareable link')} />}
        <p className="mono muted">{t('A terv a link végében, kódolva utazik – nincs szerver. A választott változatokat mutatja.', 'The plan travels encoded at the end of the link – no server. It shows the chosen variants.')}</p>
      </fieldset>

      <fieldset className="field-group">
        <legend>
          {t('Kép a rajzról', 'Image of the plan')}
          {area ? ` – ${area.name}` : ''}
        </legend>
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
          <span>{t('Jelmagyarázattal (kód → növény, darabszám)', 'With legend (code → plant, count)')}</span>
        </label>
        <p className="mono muted">
          {month
            ? t('Az évszaknézet színeivel.', 'With the season view colours.')
            : t('A szerkesztett változat, alapszínekkel. Évszaknézetből az adott hónap színeit kapod.', 'The edited variant in base colours. From the season view you get that month’s colours.')}
        </p>
      </fieldset>

      <fieldset className="field-group">
        <legend>{t('Látványterv ChatGPT-nek', 'Visualisation with ChatGPT')}</legend>
        <p className="mono muted">{t('Leírás és rajz a ChatGPT-nek egy lépésben, nézőponttal, stílussal; a kész képek a változat mellett maradnak.', 'Description and plan for ChatGPT in one step, with a viewpoint and style; the finished images stay with the variant.')}</p>
        <button type="button" className="btn btn-small btn-primary" onClick={onVisual} disabled={!area}>
          {t('Látványterv megnyitása', 'Open visualisation')}
        </button>
      </fieldset>

      <fieldset className="field-group">
        <legend>{t('Nyomtatás / PDF (A4)', 'Print / PDF (A4)')}</legend>
        <div className="seg">
          <label className="seg-item">
            <input type="radio" name="orient" checked={orient === 'portrait'} onChange={() => setOrient('portrait')} />
            <span>{t('álló', 'portrait')}</span>
          </label>
          <label className="seg-item">
            <input type="radio" name="orient" checked={orient === 'landscape'} onChange={() => setOrient('landscape')} />
            <span>{t('fekvő', 'landscape')}</span>
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onPrint(orient)}>
          {t('Nyomtatás / mentés PDF-be', 'Print / save as PDF')}
        </button>
        <p className="mono muted">{t('Területenként egy oldal: felülnézet, négy évszak, növénylista, figyelmeztetések. A választott változatokból.', 'One page per area: plan view, four seasons, plant list, warnings. From the chosen variants.')}</p>
      </fieldset>

      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-small" onClick={onIntro}>
          {t('Bevezető újra', 'Show the intro again')}
        </button>
      </div>
      {msg && (
        <p className="toast" role="status">
          {msg}
        </p>
      )}
      <About />
    </div>
  );
}
