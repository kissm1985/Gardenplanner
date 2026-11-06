// Small bars and choices around the plan: backup reminder, camera bar, quick toggles, plan style, theme, element bar.
import { selectCurrentArea, useProject } from '../../store/projectStore';
import { requireFeature } from '../Locked';
import { hasFeature } from '../../model/tier';
import { useUi } from '../../store/uiStore';
import { getLang, setLang, t, type Lang } from '../../i18n';
import { backupNow, needsReminder, snoozeReminder, useBackupState } from '../backup';
import { setTheme, toggleTheme, useTheme, type Theme } from '../theme';

/** Gentle reminder to back the plan up to a file (it only lives on this device). */
export function BackupReminder() {
  const project = useProject((s) => s.project);
  const { last, persisted } = useBackupState();
  if (!needsReminder(project)) return null;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  return (
    <div className="backup-reminder" role="status">
      <span>
        {days == null
          ? t('A tervről még nincs mentésed.', 'You have no backup of the plan yet.')
          : t(`Az utolsó mentés ${days} napja készült.`, `The last backup was ${days} days ago.`)}{' '}
        {persisted ? '' : t('A böngésző idővel törölheti az adatokat.', 'The browser may clear the data over time.')}
      </span>
      <button type="button" className="btn btn-small btn-primary" onClick={() => backupNow(project!)}>
        {t('Mentés fájlba', 'Save to file')}
      </button>
      <button type="button" className="btn btn-small" onClick={() => snoozeReminder()}>
        {t('Később', 'Later')}
      </button>
    </div>
  );
}

/** Floating controls while placing the visualisation viewpoint. */
export function CameraBar({ onDone }: { onDone: () => void }) {
  const area = useProject(selectCurrentArea);
  const done = () => {
    useUi.getState().setCameraEdit(false);
    onDone();
  };
  return (
    <div className="shape-bar camera-bar" role="toolbar" aria-label={t('Nézőpont', 'Viewpoint')}>
      <p className="shape-hint">
        <b>{t('Nézőpont: ', 'Viewpoint: ')}</b>
        {area?.camera
          ? t('Húzd a kamerát a nézés irányába, vagy nyomj máshová az áthelyezéshez.', 'Drag from the camera towards where you look, or press elsewhere to move it.')
          : t('Nyomd meg ott, ahol állsz, és húzd a nézés irányába.', 'Press where you stand and drag towards where you look.')}
      </p>
      <div className="form-actions form-actions-start">
        {area?.camera && (
          <button type="button" className="btn btn-small btn-danger" onClick={() => useProject.getState().setCamera(null)}>
            {t('Törlés', 'Remove')}
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-small btn-primary" onClick={done}>
          {t('Kész', 'Done')}
        </button>
      </div>
    </div>
  );
}

/** One-tap language and light/dark switches in the top bar. */
export function QuickToggles() {
  const { dark } = useTheme();
  const other: Lang = getLang() === 'hu' ? 'en' : 'hu';
  return (
    <>
      <button
        type="button"
        className="icon-btn quick-btn"
        lang={other}
        onClick={() => setLang(other)}
        aria-label={other === 'en' ? 'Switch to English' : 'Váltás magyarra'}
        title={other === 'en' ? 'English' : 'Magyar'}
      >
        {other.toUpperCase()}
      </button>
      <button
        type="button"
        className="icon-btn quick-btn"
        onClick={toggleTheme}
        aria-label={dark ? t('Világos mód', 'Light mode') : t('Sötét mód', 'Dark mode')}
        title={dark ? t('Világos mód', 'Light mode') : t('Sötét mód', 'Dark mode')}
      >
        {dark ? '☀' : '☾'}
      </button>
    </>
  );
}

/** Default symbols (coloured disc + code) or the concept plan (top-view pictograms). */
export function PlanStyleChoice() {
  const style = useProject((s) => s.project?.settings.planStyle ?? 'symbol');
  const opts: ['symbol' | 'concept', string, string][] = [
    [
      'symbol',
      t('Alap: színes jel kóddal', 'Standard: coloured symbol with code'),
      t('pl. bíbor kúpvirág = rózsaszín kör „EC” felirattal', 'e.g. purple coneflower = pink disc marked “EC”'),
    ],
    [
      'concept',
      t('Koncepcióterv: növényábrák', 'Concept plan: plant drawings'),
      t('felülnézeti piktogram, a kifejlett szélesség szerint méretezve', 'top-view pictogram, sized by the mature spread'),
    ],
  ];
  return (
    <div className="plan-style">
      {opts.map(([v, label, hint]) => (
        <label key={v} className="check">
          <input
            type="radio"
            name="plan-style"
            checked={style === v}
            onChange={() => (v === 'symbol' || requireFeature('concept')) && useProject.getState().updateSettings({ planStyle: v })}
          />
          <span>
            {v === 'concept' && !hasFeature('concept') && '🔒 '}
            {label}
            <small className="mono muted"> – {hint}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

/** Automatic (system) / light / dark, in the View sheet. */
export function ThemeChoice() {
  const { theme } = useTheme();
  const opts: [Theme, string][] = [
    ['auto', t('Automatikus (rendszer)', 'Automatic (system)')],
    ['light', t('Világos', 'Light')],
    ['dark', t('Sötét', 'Dark')],
  ];
  return (
    <div className="seg">
      {opts.map(([v, label]) => (
        <label key={v} className="seg-item">
          <input type="radio" name="theme" checked={theme === v} onChange={() => setTheme(v)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export function FixtureBar({ id, label, onProps }: { id: string; label: string; onProps: () => void }) {
  return (
    <div className="selbar" role="toolbar" aria-label={t('Kijelölt elem', 'Selected element')}>
      <span className="selbar-count mono">{label}</span>
      <button type="button" className="btn btn-small" onClick={onProps}>
        {t('Adatok', 'Details')}
      </button>
      <button
        type="button"
        className="btn btn-small btn-danger"
        onClick={() => {
          useProject.getState().deleteFixture(id);
          useUi.getState().selectFixture(null);
        }}
      >
        {t('Törlés', 'Delete')}
      </button>
      <button type="button" className="icon-btn" onClick={() => useUi.getState().selectFixture(null)} aria-label={t('Kijelölés megszüntetése', 'Clear selection')}>
        ×
      </button>
    </div>
  );
}
