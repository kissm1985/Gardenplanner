// Ready-made example plans for the start page: a whole area with its fixed elements and a planted "Plan A".
// Every plan uses built-in species only (codes from plants.seed.ts) at their recommended spacing, so the
// rules panel stays quiet and the list, schedule and visualisation work straight away.
import { fillPath, fillPolygon, type Pattern } from '../engine/fill';
import { uid } from '../model/ids';
import type { Area, Fixture, FixtureType, PlacedItem, Pt } from '../model/types';
import { t } from '../i18n';
import { SEED_PLANTS } from './plants.seed';
import { curvedLawn, makeArea, type AreaInput } from './templates';

const SEED = new Map(SEED_PLANTS.map((p) => [p.code, p]));
const r1 = (n: number) => Math.round(n * 10) / 10;
const rp = (ps: Pt[]): Pt[] => ps.map(([x, y]) => [r1(x), r1(y)]);

// ---------- shape helpers (cm, origin top-left) ----------
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Soft, slightly irregular blob (deterministic), for naturalistic drifts. */
export function blob(cx: number, cy: number, rx: number, ry: number, wobble = 0.12, n = 18, phase = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    const k = 1 + wobble * Math.sin(3 * a + phase) * Math.cos(2 * a - phase / 2);
    return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)] as Pt;
  });
}

/** Ring as an open path (for a row around a circle). */
export const ring = (cx: number, cy: number, r: number, n = 48): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });

/** Ring sector between two radii and two angles (degrees, 0 = right, clockwise). */
export function sector(cx: number, cy: number, r0: number, r1_: number, a0: number, a1: number, steps = 10): Pt[] {
  const arc = (r: number, from: number, to: number) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
    });
  return [...arc(r1_, a0, a1), ...arc(r0, a1, a0)];
}

/** Closed rectangle outline as a path (for a clipped hedge around a bed). */
const loop = (x: number, y: number, w: number, h: number): Pt[] => [...rect(x, y, w, h), [x, y]];

// ---------- planting helpers ----------
function planter() {
  const items: PlacedItem[] = [];
  const spacing = (code: string) => {
    const p = SEED.get(code);
    if (!p) throw new Error(`Unknown plant code in example: ${code}`);
    return p.spacingCm;
  };
  return {
    items,
    drift(code: string, poly: Pt[], pattern: Pattern = 'staggered', spacingCm = spacing(code)) {
      const polygon = rp(poly);
      items.push({ kind: 'drift', id: uid('i'), plantId: code, polygon, pattern, spacingCm, count: fillPolygon(polygon, spacingCm, pattern).length, status: 'needed' });
    },
    row(code: string, path: Pt[], spacingCm = spacing(code)) {
      const p = rp(path);
      items.push({ kind: 'row', id: uid('i'), plantId: code, path: p, spacingCm, count: fillPath(p, spacingCm).length, status: 'needed' });
    },
    one(code: string, x: number, y: number) {
      spacing(code);
      items.push({ kind: 'plant', id: uid('i'), plantId: code, x: r1(x), y: r1(y), status: 'needed' });
    },
  };
}
type Planter = ReturnType<typeof planter>;

const fx = (type: FixtureType, label: string, x: number, y: number, w: number, h: number): Fixture => ({ id: uid('f'), type, label, x, y, w, h });
const tree = (label: string, x: number, y: number, radius: number): Fixture => ({ id: uid('f'), type: 'tree', label, x, y, radius });

export interface ExamplePlan {
  key: string;
  /** Hungarian and English name (also the area's name). */
  name: [hu: string, en: string];
  /** One line on the card: the style in a few words. */
  blurb: [hu: string, en: string];
  /** Accent colour of the card. */
  accent: string;
  area: () => AreaInput;
  plant: (p: Planter) => void;
  /** Design notes stored on the plan. */
  notes: [hu: string, en: string];
}

const L = (hu: string, en: string) => t(hu, en);

export const EXAMPLE_PLANS: ExamplePlan[] = [
  // 1 ─ Mediterranean gravel garden: silver foliage, lavender along the path, a terrace at the bottom.
  {
    key: 'mediterranean',
    name: ['Mediterrán kert', 'Mediterranean garden'],
    blurb: ['Levendulás út, ezüst levelek, kavics és terasz', 'Lavender path, silver leaves, gravel and terrace'],
    accent: '#8b6bb5',
    area: () => ({
      name: L('Mediterrán kert', 'Mediterranean garden'),
      widthCm: 800,
      lengthCm: 1000,
      orientation: 'S',
      sunUntil: L('egész nap', 'all day'),
      sunLevel: 'sun',
      soil: 'sandy',
      kind: 'gravel',
      notes: L(
        'Napos, száraz, jó vízelvezetésű kert kavicsmulccsal; öntözés csak a beállásig.',
        'Sunny, dry, free-draining garden with gravel mulch; water only until established.',
      ),
      constraints: { mulchCover: true },
      fixtures: [
        fx('paving', L('Terasz', 'Terrace'), 0, 830, 800, 170),
        fx('path', L('Kavicsos út', 'Gravel path'), 360, 0, 80, 830),
        fx('bench', L('Pad', 'Bench'), 80, 760, 150, 50),
        fx('other', L('Agyagkorsó', 'Terracotta urn'), 600, 760, 60, 60),
      ],
    }),
    plant: (p) => {
      // Columns of cypress-like false cypress at the head of the path, silver oleaster as "olive trees".
      p.one('CL', 300, 50);
      p.one('CL', 500, 50);
      p.one('EE', 160, 170);
      p.one('EE', 640, 170);
      // Lavender lines the path on both sides.
      p.row('LA', [
        [330, 140],
        [330, 800],
      ]);
      p.row('LA', [
        [470, 140],
        [470, 800],
      ]);
      p.drift('HB', rect(20, 20, 220, 90));
      p.drift('HB', rect(560, 20, 220, 90));
      p.drift('ST', rect(20, 270, 120, 220));
      p.drift('PE', rect(160, 270, 130, 220), 'grid');
      p.drift('SA', rect(510, 270, 140, 220), 'grid');
      p.drift('ST', rect(660, 270, 120, 220));
      p.drift('FE', rect(20, 520, 270, 110));
      p.drift('FE', rect(510, 520, 270, 110));
      p.drift('TH', rect(20, 640, 50, 110));
      p.drift('SE', rect(250, 650, 50, 100), 'grid');
      p.drift('TH', rect(510, 640, 80, 110));
      p.drift('SE', rect(700, 640, 80, 110), 'grid');
    },
    notes: [
      'Mediterrán hangulat hazai télállóságú fajokkal: az ezüstfa az olajfát, az oszlopos hamisciprus a ciprust idézi. Kavicsmulcs, trágya nélkül.',
      'A Mediterranean mood with hardy species: oleaster stands in for olive trees, the columnar false cypress for cypresses. Gravel mulch, no manure.',
    ],
  },

  // 2 ─ Formal château garden: four box-edged parterres around a fountain, columnar hornbeams.
  {
    key: 'chateau',
    name: ['Kastélykert', 'Château garden'],
    blurb: ['Négy puszpángkeretes parter, szökőkút, fasor', 'Four box-edged parterres, fountain, tree avenue'],
    accent: '#3f6a3a',
    area: () => ({
      name: L('Kastélykert', 'Château garden'),
      widthCm: 1200,
      lengthCm: 1600,
      orientation: 'S',
      sunUntil: L('egész nap', 'all day'),
      sunLevel: 'sun',
      soil: 'loam',
      kind: 'bed',
      notes: L(
        'Szimmetrikus, formális kert: tengelyes kavicsutak, középen szökőkút, nyírt puszpáng.',
        'Symmetrical formal garden: axial gravel walks, a fountain in the middle, clipped box.',
      ),
      fixtures: [
        fx('path', L('Főtengely', 'Main axis'), 560, 0, 80, 1600),
        fx('path', L('Keresztút', 'Cross walk'), 0, 760, 1200, 80),
        fx('pond', L('Szökőkút', 'Fountain'), 490, 690, 220, 220),
        fx('bench', L('Pad', 'Bench'), 160, 680, 150, 50),
        fx('bench', L('Pad', 'Bench'), 890, 870, 150, 50),
      ],
    }),
    plant: (p) => {
      for (const x of [90, 1110]) for (const y of [260, 1340]) p.one('CF', x, y);
      const beds: [number, number, string][] = [
        [300, 160, 'LA'],
        [660, 160, 'SA'],
        [300, 940, 'SA'],
        [660, 940, 'LA'],
      ];
      for (const [x, y, fill] of beds) {
        const w = 240;
        const h = 500;
        p.row('BX', loop(x, y, w, h));
        p.drift(fill, rect(x + 30, y + 30, w - 60, 120));
        p.drift(fill, rect(x + 30, y + h - 150, w - 60, 120));
        p.one('TB', x + w / 2, y + h / 2);
      }
    },
    notes: [
      'Francia parter mintájára: puszpángkeretes ágyások levendulával és zsályával, a parterek közepén nyírt tiszafa kúp. A puszpángot évente kétszer nyírd, figyelj a puszpángmolyra.',
      'After a French parterre: box-edged beds with lavender and salvia, a clipped yew cone in each centre. Clip the box twice a year and watch for box moth.',
    ],
  },

  // 3 ─ Country yard: well, shed, raised beds, flowering shrubs and a cottage border.
  {
    key: 'country-yard',
    name: ['Vidéki udvar', 'Country yard'],
    blurb: ['Kút, magaságyások, díszalma, virágos szegély', 'Well, raised beds, crab apple, flower border'],
    accent: '#c9704f',
    area: () => ({
      name: L('Vidéki udvar', 'Country yard'),
      widthCm: 1000,
      lengthCm: 1200,
      orientation: 'SE',
      sunUntil: L('15:00-ig', 'until 15:00'),
      sunLevel: 'sun',
      soil: 'loam',
      kind: 'bed',
      notes: L(
        'Hagyományos falusi udvar: középen gyep és kút, hátul tároló és komposzt, a kerítés mentén virágzó cserjék.',
        'Traditional village yard: lawn and well in the middle, shed and compost at the back, flowering shrubs along the fence.',
      ),
      fixtures: [
        fx('fence', L('Kerítés', 'Fence'), -6, 0, 6, 1200),
        { id: uid('f'), type: 'lawn', label: L('Gyep', 'Lawn'), x: 0, y: 0, polygon: rect(160, 300, 560, 640) },
        fx('shed', L('Tároló', 'Shed'), 0, 0, 300, 200),
        fx('compost', L('Komposztáló', 'Compost bin'), 860, 20, 120, 100),
        fx('well', L('Kút', 'Well'), 390, 570, 100, 100),
        fx('raisedBed', L('Magaságyás', 'Raised bed'), 780, 300, 120, 260),
        fx('raisedBed', L('Magaságyás', 'Raised bed'), 780, 620, 120, 260),
        fx('paving', L('Járólapok', 'Stepping path'), 400, 940, 80, 260),
        fx('bench', L('Pad', 'Bench'), 520, 250, 150, 50),
        fx('rainBarrel', L('Esővízgyűjtő', 'Rain barrel'), 310, 140, 60, 60),
      ],
    }),
    plant: (p) => {
      p.one('DA', 600, 120);
      p.one('PH', 80, 340);
      p.one('SB', 80, 560);
      p.one('HP', 80, 780);
      p.drift('AL', rect(20, 860, 120, 70));
      // Cottage border along the front.
      p.drift('LE', rect(20, 980, 170, 200));
      p.drift('EC', rect(200, 980, 180, 200));
      p.drift('RU', rect(500, 980, 160, 200));
      p.drift('HM', rect(670, 980, 160, 200));
      p.drift('AM', rect(840, 980, 140, 200));
      p.drift('NE', rect(740, 160, 240, 110));
      p.drift('GR', rect(920, 300, 70, 580), 'grid');
    },
    notes: [
      'Igénytelen, régi falusi kertek fajai: díszalma, jezsámen, bodza, hortenzia, előtte margitvirágos-kúpvirágos szegély. A magaságyásokba zöldséget, fűszert ültethetsz.',
      'Easy-going plants of old village gardens: crab apple, mock orange, elder, hydrangea, with a daisy and coneflower border in front. Grow vegetables and herbs in the raised beds.',
    ],
  },

  // 4 ─ Alpine rock garden: dwarf conifers and cushion plants between rocks.
  {
    key: 'alpine',
    name: ['Alpesi sziklakert', 'Alpine rock garden'],
    blurb: ['Törpefenyők, párnás évelők sziklák között', 'Dwarf conifers and cushion plants among rocks'],
    accent: '#7fa8c4',
    area: () => ({
      name: L('Alpesi sziklakert', 'Alpine rock garden'),
      widthCm: 600,
      lengthCm: 800,
      orientation: 'S',
      sunUntil: L('egész nap', 'all day'),
      sunLevel: 'sun',
      soil: 'poor',
      kind: 'gravel',
      notes: L('Lejtős, sovány, köves talaj, nagyon jó vízelvezetés. Zúzottkő mulcs.', 'Sloping, lean, stony soil with very good drainage. Grit mulch.'),
      constraints: { maxHeightCm: 150, mulchCover: true },
      fixtures: [
        fx('other', L('Szikla', 'Rock'), 220, 120, 120, 70),
        fx('other', L('Szikla', 'Rock'), 60, 380, 90, 60),
        fx('other', L('Szikla', 'Rock'), 400, 430, 110, 70),
        fx('other', L('Szikla', 'Rock'), 230, 640, 80, 50),
        fx('path', L('Lépőkövek', 'Stepping stones'), 270, 220, 60, 580),
      ],
    }),
    plant: (p) => {
      p.one('PM', 110, 120);
      p.one('FL', 490, 110);
      p.one('JR', 470, 690);
      p.one('PM', 100, 680);
      p.drift('SE', blob(330, 50, 60, 25), 'grid');
      p.drift('AR', blob(80, 270, 60, 50));
      p.drift('TH', blob(190, 290, 55, 55));
      p.drift('PS', blob(450, 260, 85, 55));
      p.drift('AU', blob(530, 360, 50, 60));
      p.drift('CT', blob(140, 500, 100, 45));
      p.drift('SD', blob(410, 560, 80, 40));
      p.drift('FE', blob(200, 740, 50, 45));
      p.drift('SE', blob(380, 760, 50, 25), 'grid');
      p.drift('OR', blob(550, 550, 35, 60));
    },
    notes: [
      'Hegyvidéki hangulat kis helyen: törpefenyők és fészekluc adják a vázat, köztük párnás, tavasszal virágzó évelők. Ne trágyázz, télen se maradjon pangó víz.',
      'A mountain mood in a small space: dwarf pines and a bird’s-nest spruce form the frame, with spring-flowering cushion plants between them. No fertiliser, no standing water in winter.',
    ],
  },

  // 5 ─ English garden: curving lawn between deep mixed borders, a flowering cherry and a seat.
  {
    key: 'english',
    name: ['Angolkert', 'English garden'],
    blurb: ['Íves gyep, dús évelőágyások, virágzó cseresznye', 'Curving lawn, lush mixed borders, flowering cherry'],
    accent: '#d65a98',
    area: () => ({
      name: L('Angolkert', 'English garden'),
      widthCm: 1000,
      lengthCm: 1400,
      orientation: 'SW',
      sunUntil: L('délutántól napos', 'sun from midday'),
      sunLevel: 'sun',
      soil: 'loam',
      kind: 'border',
      notes: L(
        'Kanyargó gyep két mély, rétegzett évelőágyás között, a végén pad a cseresznyefa alatt.',
        'A winding lawn between two deep layered borders, with a seat under the cherry at the far end.',
      ),
      fixtures: [
        { id: uid('f'), type: 'lawn', label: L('Gyep', 'Lawn'), x: 0, y: 0, polygon: curvedLawn(1000, 1400, 320, 70, 1400, 0.4) },
        fx('bench', L('Pad', 'Bench'), 430, 30, 150, 50),
        fx('pond', L('Kerti tó', 'Pond'), 640, 1080, 220, 150),
      ],
    }),
    plant: (p) => {
      p.one('DC', 220, 160);
      p.one('SV', 860, 180);
      p.one('HS', 860, 470);
      // Left border, back to front: tall – middle – edge.
      p.drift('CK', rect(10, 420, 80, 300));
      p.drift('AG', rect(110, 420, 100, 300));
      p.drift('VS', rect(10, 760, 90, 280));
      p.drift('LE', rect(110, 760, 100, 280));
      p.drift('EC', rect(10, 1080, 120, 300));
      p.drift('NE', rect(150, 1080, 100, 300));
      // Right border.
      p.drift('GR', blob(800, 760, 120, 100));
      p.drift('HM', blob(880, 940, 80, 70));
      p.drift('AM', rect(760, 1270, 220, 110));
      p.drift('AG', rect(880, 560, 100, 120));
      p.drift('EC', rect(890, 1060, 90, 180));
      p.drift('VS', rect(740, 300, 240, 80));
    },
    notes: [
      'Az angol „mixed border” elvén: hátul magas fűfélék és ánizsizsóp, középen veronika és margitvirág, elöl macskamenta és gólyaorr, amelyek a gyep szélére hajlanak. Virágzás júniustól októberig.',
      'On the English mixed-border principle: tall grasses and agastache at the back, speedwell and daisies in the middle, catmint and cranesbill in front, spilling over the lawn edge. Flowers from June to October.',
    ],
  },

  // 6 ─ Japanese garden: pond, raked gravel, maples and moss-like groundcover in part shade.
  {
    key: 'japanese',
    name: ['Japánkert', 'Japanese garden'],
    blurb: ['Tó, gereblyézett kavics, juharok, félárnyék', 'Pond, raked gravel, maples, part shade'],
    accent: '#b8403a',
    area: () => ({
      name: L('Japánkert', 'Japanese garden'),
      widthCm: 800,
      lengthCm: 1000,
      orientation: 'E',
      sunUntil: L('11:00-ig', 'until 11:00'),
      sunLevel: 'part',
      soil: 'acidic',
      kind: 'shade',
      notes: L(
        'Csendes, félárnyékos kert: tó, gereblyézett kavicsfelület, lépőkövek, kőlámpás.',
        'A quiet, part-shaded garden: pond, raked gravel, stepping stones and a stone lantern.',
      ),
      fixtures: [
        fx('pond', L('Kerti tó', 'Pond'), 420, 120, 300, 200),
        fx('gravel', L('Gereblyézett kavics', 'Raked gravel'), 60, 560, 340, 260),
        fx('path', L('Lépőkövek', 'Stepping stones'), 460, 380, 60, 620),
        fx('other', L('Kőlámpás', 'Stone lantern'), 360, 140, 40, 40),
        fx('bench', L('Pad', 'Bench'), 600, 880, 150, 50),
      ],
    }),
    plant: (p) => {
      p.one('BG', 200, 200);
      p.one('AC', 640, 440);
      p.one('IC', 50, 330);
      p.one('IC', 50, 480);
      p.one('TR', 720, 680);
      p.one('FL', 300, 900);
      p.drift('PA', blob(220, 420, 120, 50), 'staggered');
      p.drift('HK', blob(330, 50, 70, 35));
      p.drift('CA', blob(750, 360, 40, 80));
      p.drift('DR', rect(20, 20, 100, 100));
      p.drift('PA', rect(20, 860, 200, 120), 'grid');
      p.drift('HK', blob(580, 580, 50, 90));
    },
    notes: [
      'Kevés faj, sok nyugalom: a juharok adják az őszi színt, a japán kövérke és a sás a mohaszerű talajtakarást. A kavicsot nem ültetjük be. A japán juhar savanyú, nedves talajt kér.',
      'Few species, lots of calm: the maples give autumn colour, pachysandra and sedge the moss-like ground. The gravel stays unplanted. Japanese maples like acid, moist soil.',
    ],
  },

  // 7 ─ Prairie garden: grasses and perennials in loose, interlocking drifts with a mown path.
  {
    key: 'prairie',
    name: ['Prérikert', 'Prairie garden'],
    blurb: ['Díszfüvek és évelők laza, egymásba futó foltokban', 'Grasses and perennials in loose, flowing drifts'],
    accent: '#e0a43a',
    area: () => ({
      name: L('Prérikert', 'Prairie garden'),
      widthCm: 800,
      lengthCm: 1000,
      orientation: 'S',
      sunUntil: L('egész nap', 'all day'),
      sunLevel: 'sun',
      soil: 'loam',
      kind: 'bed',
      notes: L(
        'Naturalisztikus ültetés: egy év alatt beáll, alig kell öntözni, télen is szép. Kora tavasszal egyszer vágjuk vissza.',
        'Naturalistic planting: settles in a year, needs little water, beautiful in winter too. Cut back once in early spring.',
      ),
      fixtures: [fx('path', L('Nyírt ösvény', 'Mown path'), 360, 0, 80, 1000)],
    }),
    plant: (p) => {
      // Interlocking drifts on both sides of the mown path, grasses as the matrix.
      p.drift('CK', blob(150, 110, 150, 100, 0.12, 18, 1));
      p.drift('EC', blob(250, 330, 100, 120, 0.12, 18, 2));
      p.drift('SI', blob(80, 360, 70, 140, 0.12, 18, 3));
      p.drift('AG', blob(240, 600, 110, 110, 0.12, 18, 4));
      p.drift('PN', blob(80, 640, 70, 120, 0.12, 18, 5));
      p.drift('HH', blob(95, 880, 80, 90, 0.12, 18, 6));
      p.drift('SA', blob(280, 860, 70, 110, 0.12, 18, 13));
      p.drift('MO', blob(650, 110, 150, 100, 0.12, 18, 7));
      p.drift('RU', blob(550, 340, 100, 110, 0.12, 18, 8));
      p.drift('HB', blob(720, 380, 70, 130, 0.12, 18, 9));
      p.drift('PE', blob(560, 620, 110, 110, 0.12, 18, 10));
      p.drift('AM', blob(745, 680, 50, 120, 0.12, 18, 11));
      p.drift('EU', blob(530, 880, 80, 90, 0.12, 18, 12));
      p.drift('SI', blob(710, 890, 80, 90, 0.12, 18, 14));
    },
    notes: [
      'Piet Oudolf-féle naturalisztikus stílus: a fűfélék adják a hullámzó alapot, a bíbor és sárga kúpvirág, az ánizsizsóp és a perovszkia a színt. A száraz magszárakat télre hagyd meg.',
      'A naturalistic style in the manner of the New Perennial movement: grasses give the swaying base, coneflower, agastache, rudbeckia and perovskia the colour. Leave the seed heads for winter.',
    ],
  },

  // 8 ─ Shade garden under a large tree: foliage textures, ferns and spring flowers.
  {
    key: 'shade',
    name: ['Árnyékkert', 'Shade garden'],
    blurb: ['Páfrányok, árnyékliliomok, tavaszi virágok fa alatt', 'Ferns, hostas and spring flowers under a tree'],
    accent: '#5f8f6a',
    area: () => ({
      name: L('Árnyékkert', 'Shade garden'),
      widthCm: 700,
      lengthCm: 900,
      orientation: 'N',
      sunUntil: L('alig napos', 'barely any sun'),
      sunLevel: 'shade',
      soil: 'loam',
      kind: 'shade',
      notes: L(
        'Nagy lombos fa alatti, hűvös, humuszos sarok. Lombmulcs, nyáron öntözés.',
        'A cool, humus-rich corner under a large deciduous tree. Leaf-mould mulch, summer watering.',
      ),
      fixtures: [
        tree(L('Meglévő fa', 'Existing tree'), 350, 380, 320),
        fx('path', L('Kéregmulcsos ösvény', 'Bark path'), 0, 620, 700, 70),
        fx('bench', L('Pad', 'Bench'), 280, 540, 150, 50),
      ],
    }),
    plant: (p) => {
      p.drift('DR', blob(120, 110, 90, 80));
      p.drift('HO', blob(330, 100, 110, 70));
      p.drift('PU', blob(570, 120, 100, 90));
      p.drift('HE', blob(100, 330, 80, 90));
      p.drift('EP', blob(270, 330, 70, 70));
      p.drift('BR', blob(470, 330, 80, 80));
      p.drift('HL', blob(620, 360, 60, 90));
      p.drift('VI', rect(20, 470, 240, 120), 'grid');
      p.drift('LU', rect(460, 470, 220, 120));
      p.drift('AS', blob(130, 790, 110, 80));
      p.drift('HK', blob(350, 800, 100, 70));
      p.drift('CA', blob(570, 790, 110, 80));
    },
    notes: [
      'Az árnyékban a levél a főszereplő: páfrány, árnyékliliom, tűzeső és sás. Tavasszal tüdőfű, püspöksüveg, nefelejcs és hunyor nyílik. A meglévő fát nem ültetjük, csak alá.',
      'In shade the leaves are the stars: fern, hosta, heuchera and sedge. In spring lungwort, barrenwort, brunnera and hellebore flower. The tree is existing; we only plant beneath it.',
    ],
  },

  // 9 ─ Modern city garden: terrace, clean blocks of grasses, box balls and columnar cherries.
  {
    key: 'modern',
    name: ['Modern városi kert', 'Modern city garden'],
    blurb: ['Terasz, letisztult tömbök, fűfélék és gömbök', 'Terrace, clean blocks, grasses and spheres'],
    accent: '#86a5b8',
    area: () => ({
      name: L('Modern városi kert', 'Modern city garden'),
      widthCm: 600,
      lengthCm: 900,
      orientation: 'W',
      sunUntil: L('13:00-tól', 'from 13:00'),
      sunLevel: 'sun',
      soil: 'loam',
      kind: 'bed',
      notes: L('Kis, falakkal határolt belvárosi kert, nagy terasszal és geometrikus ágyásokkal.', 'A small walled city garden with a large terrace and geometric beds.'),
      fixtures: [
        fx('wall', L('Fal', 'Wall'), -16, 0, 16, 900),
        fx('wall', L('Fal', 'Wall'), 600, 0, 16, 900),
        fx('paving', L('Terasz', 'Terrace'), 0, 640, 600, 260),
        fx('paving', L('Járólap', 'Stepping slab'), 260, 300, 80, 340),
        fx('bench', L('Kültéri pad', 'Outdoor bench'), 60, 720, 200, 50),
      ],
    }),
    plant: (p) => {
      for (const x of [100, 300, 500]) p.one('DO', x, 60);
      p.drift('CK', rect(20, 160, 220, 120), 'grid');
      p.drift('CK', rect(360, 160, 220, 120), 'grid');
      p.drift('LA', rect(20, 310, 220, 130), 'grid');
      p.drift('LA', rect(360, 310, 220, 130), 'grid');
      p.drift('BX', rect(30, 470, 200, 140), 'grid', 70);
      p.drift('BX', rect(370, 470, 200, 140), 'grid', 70);
    },
    notes: [
      'Kevés faj, ismétlés, tiszta vonalak: oszlopos díszcseresznye hátul, nádtippan tömbök, levendula és puszpánggömbök a terasz előtt. Egész évben rendezett, kevés munka.',
      'Few species, repetition, clean lines: columnar cherries at the back, feather-grass blocks, lavender and box balls before the terrace. Tidy all year with little work.',
    ],
  },

  // 10 ─ Round pollinator garden: a circle of nectar plants in wedges around a bird bath.
  {
    key: 'pollinator',
    name: ['Kerek pillangókert', 'Round pollinator garden'],
    blurb: ['Kör alakú, nektárgazdag cikkek madáritatóval', 'Circular, nectar-rich wedges around a bird bath'],
    accent: '#5a4fc0',
    area: () => ({
      name: L('Kerek pillangókert', 'Round pollinator garden'),
      widthCm: 700,
      lengthCm: 700,
      round: true,
      orientation: 'S',
      sunUntil: L('egész nap', 'all day'),
      sunLevel: 'sun',
      soil: 'loam',
      kind: 'bed',
      notes: L(
        'Kör alakú ágyás a gyep közepén, középen madáritató; méheknek és lepkéknek márciustól októberig.',
        'A round bed in the lawn with a bird bath in the centre; for bees and butterflies from March to October.',
      ),
      constraints: { nonToxic: false },
      fixtures: [fx('well', L('Madáritató', 'Bird bath'), 310, 310, 80, 80)],
    }),
    plant: (p) => {
      const c = 350;
      const wedges: string[] = ['NE', 'AG', 'EC', 'SA', 'VS', 'AM', 'PE', 'HH'];
      wedges.forEach((code, i) => p.drift(code, sector(c, c, 150, 320, i * 45 + 2, i * 45 + 43)));
      p.row('TH', ring(c, c, 100, 24));
    },
    notes: [
      'Nyolc nektárgazdag cikk váltakozó színekkel, a belső körben kakukkfű. A sorrend úgy van megválasztva, hogy tavasztól őszig mindig nyíljon valami.',
      'Eight nectar-rich wedges in alternating colours, with thyme in the inner ring. The order keeps something in flower from spring to autumn.',
    ],
  },
];

/** A new area for the example, with its planted "Plan A" and design notes. */
export function buildExample(ex: ExamplePlan): Area {
  const area = makeArea(ex.area());
  const p = planter();
  ex.plant(p);
  const items = p.items.filter((it) => it.kind !== 'drift' || it.count > 0);
  return { ...area, variants: [{ ...area.variants[0], items, notes: t(...ex.notes) }] };
}

/** Plant codes an example uses (to put back species the user deleted from the database). */
export function exampleCodes(area: Area): string[] {
  return [...new Set(area.variants.flatMap((v) => v.items.map((it) => it.plantId)))];
}

/** Every name the examples give (area names and their element labels), for language switching. */
export const EXAMPLE_NAME_PAIRS: [string, string][] = [
  ...EXAMPLE_PLANS.map((e) => e.name),
  ['Terasz', 'Terrace'],
  ['Kavicsos út', 'Gravel path'],
  ['Agyagkorsó', 'Terracotta urn'],
  ['Főtengely', 'Main axis'],
  ['Keresztút', 'Cross walk'],
  ['Szökőkút', 'Fountain'],
  ['Járólapok', 'Stepping path'],
  ['Szikla', 'Rock'],
  ['Lépőkövek', 'Stepping stones'],
  ['Gereblyézett kavics', 'Raked gravel'],
  ['Kőlámpás', 'Stone lantern'],
  ['Nyírt ösvény', 'Mown path'],
  ['Meglévő fa', 'Existing tree'],
  ['Kéregmulcsos ösvény', 'Bark path'],
  ['Járólap', 'Stepping slab'],
  ['Kültéri pad', 'Outdoor bench'],
  ['Madáritató', 'Bird bath'],
];
