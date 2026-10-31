import { useEffect, useRef, useState } from 'react';
import { bomFromEntries } from '../engine/bom';
import { SEASON_LABEL, SEASON_MONTH, type Season } from '../engine/season';
import { buildVisualPrompt, type Lang, type PromptOptions, type TimeOfDay, type Viewpoint, type VizStyle, type Weather } from '../engine/visualPrompt';
import { locale, t } from '../i18n';
import { plantName } from '../model/plants';
import type { Area, Project, Render, Variant } from '../model/types';
import { activeVariant, selectCurrentArea, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { copy } from './clipboard';
import { downloadBlob } from './download';
import { planSvg, svgToPng, type LegendRow } from './exportImage';
import { localName } from '../i18n/names';
import { loadImage } from './imageFile';

const CHATGPT_URL = 'https://chatgpt.com/';
const m1 = (cm: number) => (cm / 100).toLocaleString(locale(), { maximumFractionDigits: 1 });

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** The plan of one variant as a PNG with a legend and the viewpoint, always in light colours (reads best for the image model). */
export async function vizPng(project: Project, area: Area, v: Variant, season: Season): Promise<Blob> {
  const legend: LegendRow[] = bomFromEntries([{ area, items: v.items }], project.plantDb, project.settings.reservePct).rows.map((r) => ({
    code: r.plant.code,
    nameHu: plantName(r.plant),
    nameLat: r.plant.nameLat,
    color: r.plant.color,
    symbol: r.plant.symbol,
    count: r.planted,
  }));
  const root = document.documentElement;
  const theme = root.dataset.theme;
  root.dataset.theme = 'light';
  let svg: string;
  try {
    svg = planSvg({ area, items: v.items, plantDb: project.plantDb, month: SEASON_MONTH[season], legend, camera: area.camera, caption: `${localName(area.name)} – ${localName(v.name)} · ${area.widthCm} × ${area.lengthCm} cm` });
  } finally {
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
  }
  return svgToPng(svg);
}

/** Phones and tablets get the share sheet; computers copy, download and open ChatGPT. */
const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** "Látványterv": brief for ChatGPT from a viewpoint on the plan, sent in one step; the images made are kept with the variant. */
export function VisualPanel({ onPickCamera }: { onPickCamera: () => void }) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const opt = useUi((s) => s.vizOptions);
  const setOpt = (patch: Partial<PromptOptions>) => useUi.getState().setVizOptions({ ...opt, ...patch });
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [png, setPng] = useState<Blob | null>(null);
  const [viewing, setViewing] = useState<Render | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const v = area ? activeVariant(area) : null;

  // The PNG is made ahead, so the share sheet opens straight from the tap (Safari requires that).
  useEffect(() => {
    if (!area || !v) return;
    let live = true;
    setPng(null);
    const id = window.setTimeout(() => {
      vizPng(project, area, v, opt.season).then((b) => live && setPng(b), () => {});
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [project, area, v, opt.season]);

  if (!area || !v) return <p className="mono muted">{t('Nincs kiválasztott terület.', 'No area selected.')}</p>;

  const fileName = `${slug(localName(area.name))}-${slug(localName(v.name))}${t('-latvanyterv', '-visualisation')}.png`;
  const brief = () => {
    const s = buildVisualPrompt(project, area, v.items, opt);
    setText(s);
    return s;
  };

  const send = async () => {
    const s = brief();
    const blob = png ?? (await vizPng(project, area, v, opt.season));
    const file = new File([blob], fileName, { type: 'image/png' });
    if (isTouch() && navigator.canShare?.({ files: [file] })) {
      // The text also goes to the clipboard, for apps that only take the picture from a share.
      navigator.clipboard?.writeText(s).catch(() => {});
      try {
        await navigator.share({ files: [file], text: s, title: t('Látványterv', 'Visualisation') });
        setMsg(t('Elküldve. Ha a ChatGPT csak a képet kapta meg, a leírás a vágólapon van: illeszd be mellé.', 'Sent. If ChatGPT only got the picture, the description is on the clipboard: paste it next to it.'));
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setMsg(t('A megosztás nem indult el. Koppints újra, vagy használd a lenti gombokat.', 'Sharing did not start. Tap again, or use the buttons below.'));
      }
      return;
    }
    await new Promise((r) => setTimeout(r));
    const ok = await copy(s, taRef.current);
    downloadBlob(fileName, blob, 'image/png');
    const w = window.open(CHATGPT_URL, '_blank', 'noopener');
    setMsg(
      (ok ? t('A leírás a vágólapon, a rajz letöltve. ', 'The description is on the clipboard and the plan downloaded. ') : t('A rajz letöltve; a leírást másold ki a lenti mezőből. ', 'The plan downloaded; copy the description from the box below. ')) +
        (w
          ? t('A ChatGPT új lapon nyílt meg: illeszd be a szöveget (Ctrl+V), és húzd mellé a letöltött képet.', 'ChatGPT opened in a new tab: paste the text (Ctrl+V) and drop the downloaded image next to it.')
          : t('Nyisd meg a chatgpt.com-ot, illeszd be a szöveget, és csatold a képet.', 'Open chatgpt.com, paste the text and attach the image.')),
    );
  };

  const copyText = async () => {
    const s = brief();
    await new Promise((r) => setTimeout(r));
    const ok = await copy(s, taRef.current);
    setMsg(ok ? t('A leírás kimásolva.', 'Description copied.') : t('Jelöld ki és másold ki a szöveget a mezőből.', 'Select and copy the text from the box.'));
  };

  const savePng = async () => downloadBlob(fileName, png ?? (await vizPng(project, area, v, opt.season)), 'image/png');

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      for (const f of [...files]) {
        const { dataUrl } = await loadImage(f, 1600);
        useProject.getState().addRender(v.id, { dataUrl, addedAt: new Date().toISOString() });
      }
      setMsg(t(`Kép mentve a(z) „${localName(v.name)}” változathoz.`, `Image saved with the variant “${localName(v.name)}”.`));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const renders = v.renders ?? [];
  const cam = area.camera;
  const sel = <K extends keyof PromptOptions>(k: K, label: string, opts: [PromptOptions[K], string][]) => (
    <label className="field">
      <span className="lbl">{label}</span>
      <select value={String(opt[k])} onChange={(e) => setOpt({ [k]: opts.find(([val]) => String(val) === e.target.value)![0] } as Partial<PromptOptions>)}>
        {opts.map(([val, l]) => (
          <option key={String(val)} value={String(val)}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="form visual-panel">
      <p className="mono muted">
        {t(
          `A(z) „${localName(area.name)}” terület „${localName(v.name)}” változatáról készül leírás és rajz a ChatGPT-nek. A kész képet töltsd vissza ide: a változat mellett marad, és az összehasonlításban is látszik.`,
          `A description and plan of the “${localName(v.name)}” variant of “${localName(area.name)}” for ChatGPT. Upload the finished image here: it stays with the variant and shows in the comparison.`,
        )}
      </p>

      <fieldset className="field-group">
        <legend>{t('Nézőpont', 'Viewpoint')}</legend>
        <p className="mono muted">
          {cam
            ? t(`Kamera a rajzon: (${m1(cam.x)}; ${m1(cam.y)}) m, a narancssárga látómező felé néz.`, `Camera on the plan: (${m1(cam.x)}, ${m1(cam.y)}) m, looking along the orange view cone.`)
            : t('Tedd le a kamerát oda, ahonnan nézni fogod a kertet (pl. a teraszra), és húzd a nézés irányába.', 'Put the camera where you will look at the garden from (e.g. the terrace) and drag towards where you look.')}
        </p>
        <div className="form-actions form-actions-start">
          <button type="button" className="btn btn-small" onClick={onPickCamera}>
            {cam ? t('Kamera áthelyezése', 'Move the camera') : t('📷 Nézőpont a rajzon', '📷 Viewpoint on the plan')}
          </button>
          {cam && (
            <button type="button" className="btn btn-small btn-danger" onClick={() => useProject.getState().setCamera(null)}>
              {t('Kamera törlése', 'Remove camera')}
            </button>
          )}
        </div>
        {sel('viewpoint', t('Kép', 'Image'), [
          ['camera', cam ? t('a kamerából (szemmagasság)', 'from the camera (eye level)') : t('a kamerából – előbb tedd le', 'from the camera – place it first')],
          ['aerial', t('madártávlatból', "bird's-eye")],
          ['both', t('mindkettő (két kép)', 'both (two images)')],
          ['eye', t('általános, az alsó szélről', 'generic, from the bottom edge')],
        ] as [Viewpoint, string][])}
      </fieldset>

      <fieldset className="field-group">
        <legend>{t('Stílus és hangulat', 'Style and mood')}</legend>
        <div className="field-row">
          {sel('style', t('Stílus', 'Style'), [
            ['photo', t('fotórealisztikus', 'photorealistic')],
            ['watercolor', t('akvarell', 'watercolour')],
            ['sketch', t('tervezői vázlat', 'design sketch')],
          ] as [VizStyle, string][])}
          {sel('season', t('Évszak', 'Season'), SEASON_LABEL.map((l, i) => [i as Season, l]))}
        </div>
        <div className="field-row">
          {sel('time', t('Napszak', 'Time of day'), [
            ['morning', t('reggel', 'morning')],
            ['afternoon', t('délután', 'afternoon')],
            ['sunset', t('naplemente', 'sunset')],
          ] as [TimeOfDay, string][])}
          {sel('weather', t('Időjárás', 'Weather'), [
            ['sunny', t('napos', 'sunny')],
            ['overcast', t('borús', 'overcast')],
          ] as [Weather, string][])}
        </div>
        <div className="field-row">
          {sel('lang', t('A leírás nyelve', 'Language of the brief'), [
            ['hu', t('magyar', 'Hungarian')],
            ['en', t('angol', 'English')],
          ] as [Lang, string][])}
          <label className="check">
            <input type="checkbox" checked={opt.mature} onChange={(e) => setOpt({ mature: e.target.checked })} />
            <span>{t('Kifejlett állapot (2–3 év múlva)', 'Mature (in 2–3 years)')}</span>
          </label>
        </div>
      </fieldset>

      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-primary" onClick={send}>
          {t('Küldés a ChatGPT-nek', 'Send to ChatGPT')}
        </button>
        <button type="button" className="btn btn-small" onClick={copyText}>
          {t('Leírás másolása', 'Copy description')}
        </button>
        <button type="button" className="btn btn-small" onClick={savePng}>
          {t('Rajz PNG-ben', 'Plan as PNG')}
        </button>
      </div>
      <p className="mono muted">
        {t(
          'Telefonon a megosztó menü nyílik meg: válaszd a ChatGPT-t, és a leírás a rajzzal együtt érkezik. Számítógépen a leírás a vágólapra kerül, a rajz letöltődik, és új lapon megnyílik a ChatGPT.',
          'On a phone the share sheet opens: pick ChatGPT and the description arrives with the plan. On a computer the description goes to the clipboard, the plan downloads and ChatGPT opens in a new tab.',
        )}
      </p>
      {msg && (
        <p className="toast" role="status">
          {msg}
        </p>
      )}
      {text && <textarea ref={taRef} className="sched-text" readOnly rows={8} value={text} onFocus={(e) => e.currentTarget.select()} aria-label={t('Leírás a látványtervhez', 'Visualisation description')} />}

      <fieldset className="field-group">
        <legend>{t(`Kész látványképek – ${localName(v.name)}`, `Finished images – ${localName(v.name)}`)}</legend>
        {viewing ? (
          <figure className="render-view">
            <img src={viewing.dataUrl} alt={t('Látványkép', 'Visualisation')} />
            <figcaption className="mono muted">{new Date(viewing.addedAt).toLocaleString(locale())}</figcaption>
            <div className="form-actions form-actions-start">
              <button type="button" className="btn btn-small" onClick={() => setViewing(null)}>
                {t('Vissza', 'Back')}
              </button>
              <a className="btn btn-small" href={viewing.dataUrl} download={`${slug(localName(area.name))}-${slug(localName(v.name))}-${viewing.id}.jpg`}>
                {t('Letöltés', 'Download')}
              </a>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => {
                  useProject.getState().deleteRender(v.id, viewing.id);
                  setViewing(null);
                }}
              >
                {t('Törlés', 'Delete')}
              </button>
            </div>
          </figure>
        ) : (
          <>
            {renders.length > 0 ? (
              <ul className="render-grid" aria-label={t('Látványképek', 'Visualisations')}>
                {renders.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setViewing(r)} aria-label={t(`Kép: ${new Date(r.addedAt).toLocaleDateString(locale())}`, `Image: ${new Date(r.addedAt).toLocaleDateString(locale())}`)}>
                      <img src={r.dataUrl} alt="" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mono muted">{t('Még nincs kép. A ChatGPT-ben mentsd le a kapott képet, majd töltsd fel ide.', 'No image yet. Save the image ChatGPT made, then upload it here.')}</p>
            )}
            <div className="form-actions form-actions-start">
              <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
                {t('Kép feltöltése', 'Upload image')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                aria-label={t('Látványkép feltöltése', 'Upload a visualisation')}
                onChange={(e) => {
                  const f = e.target.files;
                  upload(f).finally(() => (e.target.value = ''));
                }}
              />
            </div>
          </>
        )}
      </fieldset>
    </div>
  );
}
