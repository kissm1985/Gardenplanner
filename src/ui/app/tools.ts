// Toolbar tools, their help chapters and the view layers.
import { type Layers, type Tool } from '../../store/uiStore';
import { type HelpKey } from '../helpSections';
import { labels } from '../../i18n';

// Tools arrive phase by phase (SPEC §7); unavailable ones are shown but disabled.
export const TOOL_LABEL = labels<Tool>({
  select: ['Kijelölés', 'Select'],
  plant: ['Növény', 'Plant'],
  drift: ['Folt', 'Drift'],
  row: ['Sor', 'Row'],
  fixtures: ['Elemek', 'Elements'],
  season: ['Évszak', 'Season'],
  list: ['Lista', 'List'],
});
export const TOOLS: { id: Tool; icon: string; ready: boolean }[] = [
  { id: 'select', icon: '↖', ready: true },
  { id: 'plant', icon: '✿', ready: true },
  { id: 'drift', icon: '⬭', ready: true },
  { id: 'row', icon: '⋯', ready: true },
  { id: 'fixtures', icon: '▦', ready: true },
  { id: 'season', icon: '◐', ready: true },
  { id: 'list', icon: '☰', ready: true },
];

/** Which chapter of the guide the help opens at, by the active tool. */
export const HELP_SECTION: Partial<Record<Tool, HelpKey>> = {
  plant: 'placing',
  drift: 'placing',
  row: 'placing',
  fixtures: 'fixtures',
  season: 'season',
  list: 'list',
};

export const LAYER_LABELS: Record<keyof Layers, string> = labels({
  background: ['Háttérkép', 'Background image'],
  warnings: ['Figyelmeztetések', 'Warnings'],
  plants: ['Növények', 'Plants'],
  spacing: ['Tőtáv-körök', 'Spacing circles'],
  grid: ['Rácsháló', 'Grid'],
  fixtures: ['Rögzített elemek', 'Fixed elements'],
  zones: ['Juglone-zóna', 'Juglone zone'],
  dimensions: ['Méretvonalak', 'Dimensions'],
  camera: ['Látványterv nézőpontja (kamera)', 'Visualisation viewpoint (camera)'],
});
