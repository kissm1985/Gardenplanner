// PDF of the 3D render (spec v0.2 F1): A4 landscape, the render on the first page, then the plant list with every
// plant's id, species and position. Text is real text (searchable), in DejaVu Sans so Hungarian letters print.
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import boldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import regularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import { t } from '../i18n';
import type { Manifest } from './verify';

const A4: [number, number] = [841.89, 595.28];
const MARGIN = 36;
const INK = rgb(0.12, 0.16, 0.13);
const MUTE = rgb(0.36, 0.39, 0.35);
const GREEN = rgb(0.14, 0.29, 0.24);

async function bytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font: HTTP ${res.status}`);
  return res.arrayBuffer();
}

/** Downscaled JPEG of the render for the PDF (keeps the file small; the PNG download keeps full quality). */
async function jpegOf(pngDataUrl: string, maxW = 1800): Promise<Uint8Array> {
  const img = new Image();
  img.src = pngDataUrl;
  await img.decode();
  const k = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}

export interface PdfMeta {
  title: string;
  project: string;
  date?: string;
}

export async function renderPdf(png: string, manifest: Manifest, meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [reg, bold] = await Promise.all([bytes(regularUrl), bytes(boldUrl)]).then(([r, b]) =>
    Promise.all([doc.embedFont(r, { subset: true }), doc.embedFont(b, { subset: true })]),
  );
  doc.setTitle(`${meta.title} – ${t('látványterv', 'visualisation')}`);
  doc.setAuthor('Planterra');
  doc.setCreator('Planterra');
  const date = meta.date ?? new Date().toISOString().slice(0, 10);
  const plants = manifest.plants;
  const species = new Map<string, { name: string; n: number }>();
  for (const p of plants) species.set(p.species_id, { name: p.species_name, n: (species.get(p.species_id)?.n ?? 0) + 1 });

  const footer = (page: PDFPage, n: number) => {
    page.drawText(`Planterra · ${meta.project} · ${date}`, { x: MARGIN, y: 18, size: 8, font: reg, color: MUTE });
    const s = `${n}`;
    page.drawText(s, { x: A4[0] - MARGIN - reg.widthOfTextAtSize(s, 8), y: 18, size: 8, font: reg, color: MUTE });
  };

  // Page 1: title, render, species summary.
  const p1 = doc.addPage(A4);
  p1.drawText(meta.title, { x: MARGIN, y: A4[1] - MARGIN - 14, size: 18, font: bold, color: INK });
  p1.drawText(
    t(
      `Látványterv a terv adataiból · ${plants.length} növény · ${species.size} faj · a növénylista a következő oldalakon`,
      `Visualisation from the plan data · ${plants.length} plants · ${species.size} species · plant list on the next pages`,
    ),
    { x: MARGIN, y: A4[1] - MARGIN - 32, size: 9.5, font: reg, color: MUTE },
  );
  const img = await doc.embedJpg(await jpegOf(png));
  const sideW = 200;
  const boxW = A4[0] - 2 * MARGIN - sideW - 16;
  const boxH = A4[1] - 2 * MARGIN - 60;
  const k = Math.min(boxW / img.width, boxH / img.height);
  p1.drawImage(img, { x: MARGIN, y: A4[1] - MARGIN - 48 - img.height * k, width: img.width * k, height: img.height * k });
  let y = A4[1] - MARGIN - 56;
  const sx = A4[0] - MARGIN - sideW;
  p1.drawText(t('Fajok', 'Species'), { x: sx, y, size: 11, font: bold, color: GREEN });
  y -= 16;
  for (const [code, s] of [...species.entries()].sort((a, b) => b[1].n - a[1].n)) {
    if (y < MARGIN + 20) break;
    p1.drawText(`${String(s.n).padStart(3)} × ${code}`, { x: sx, y, size: 8.5, font: bold, color: INK });
    p1.drawText(fit(s.name, reg, 8.5, sideW - 62), { x: sx + 62, y, size: 8.5, font: reg, color: INK });
    y -= 12;
  }
  footer(p1, 1);

  // Plant list: one row per plant (id, species, position).
  const cols = [
    { h: t('Növény azonosító', 'Plant id'), w: 190 },
    { h: t('Faj', 'Species'), w: 60 },
    { h: t('Faj neve', 'Species name'), w: 300 },
    { h: 'x (m)', w: 60 },
    { h: 'y (m)', w: 60 },
  ];
  let page: PDFPage | null = null;
  let n = 1;
  const header = (pg: PDFPage) => {
    let yy = A4[1] - MARGIN - 12;
    pg.drawText(t(`Növénylista – ${meta.title}`, `Plant list – ${meta.title}`), { x: MARGIN, y: yy, size: 13, font: bold, color: INK });
    yy -= 22;
    let x = MARGIN;
    for (const c of cols) {
      pg.drawText(c.h, { x, y: yy, size: 8.5, font: bold, color: GREEN });
      x += c.w;
    }
    pg.drawLine({ start: { x: MARGIN, y: yy - 4 }, end: { x: A4[0] - MARGIN, y: yy - 4 }, thickness: 0.6, color: GREEN });
    return yy - 16;
  };
  y = 0;
  for (const p of plants) {
    if (!page || y < MARGIN + 16) {
      page = doc.addPage(A4);
      footer(page, ++n);
      y = header(page);
    }
    const cells = [p.plant_id, p.species_id, p.species_name, (p.required_xy_m?.[0] ?? p.placed_xy_m[0]).toFixed(2), (p.required_xy_m?.[1] ?? p.placed_xy_m[1]).toFixed(2)];
    let x = MARGIN;
    cells.forEach((c, i) => {
      page!.drawText(fit(c, reg, 8, cols[i].w - 8), { x, y, size: 8, font: reg, color: INK });
      x += cols[i].w;
    });
    y -= 11.5;
  }
  return doc.save();
}

/** Shortens text with an ellipsis to fit the width. */
function fit(s: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(s, size) <= width) return s;
  let out = s;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > width) out = out.slice(0, -1);
  return `${out}…`;
}
