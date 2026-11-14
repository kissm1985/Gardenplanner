// Minimal XLSX reader for price list imports (PL-BE-03): the first worksheet as rows of text. Works in the
// browser and on the server (no DOM): an .xlsx is a zip of XML parts; only shared strings and cell values are read.
import { strFromU8, unzipSync } from 'fflate';

const MAX_BYTES = 10 * 1024 * 1024;

const unescapeXml = (s: string) =>
  s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'amp') return '&';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const n = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
  });

const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

/** Column letters → 0-based index ("A" → 0, "AB" → 27). */
const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export function readXlsx(bytes: Uint8Array): string[][] {
  if (bytes.length > MAX_BYTES) throw new Error('A fájl túl nagy (max. 10 MB). / The file is too large (max 10 MB).');
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name) });
  } catch {
    throw new Error('Ez nem XLSX-fájl. / This is not an XLSX file.');
  }
  const sheetName = Object.keys(files)
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!sheetName) throw new Error('Nincs munkalap a fájlban. / No worksheet in the file.');
  const shared = files['xl/sharedStrings.xml'] ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : [];
  const xml = strFromU8(files[sheetName]);
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = texts(body);
      else if (v != null) value = unescapeXml(v);
      const i = ref ? colIndex(ref) : row.length;
      if (i >= 0 && i < 200) row[i] = value;
    }
    rows.push(Array.from(row, (c) => c ?? ''));
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
