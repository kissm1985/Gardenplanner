import '@fontsource-variable/outfit';
import { band, installErrorReporting, track } from './engine/analytics';
import { getLang } from './i18n';
import { getTier } from './model/tier';

installErrorReporting(__APP_VERSION__);
import '@fontsource-variable/fraunces';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/print.css';

import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';

// Shared links open a read-only view; its code (and the decompression) loads only then.
const ReadOnlyView = lazy(() => import('./ui/ReadOnlyView').then((m) => ({ default: m.ReadOnlyView })));
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { useLang } from './i18n';
import { SHARE_PREFIX } from './engine/io';
import { autosave, loadProject, setCurrentProjectId, StoredProjectError } from './store/persist';
import { useProjects } from './store/projects';
import { ErrorBoundary, RecoveryScreen } from './ui/Recovery';
import { useProject } from './store/projectStore';

autosave.onError(() => {
  // Storage can fail (private mode, quota); keep working in memory and say so.
  document.documentElement.dataset.saveError = '1';
});

function Root() {
  const [loading, setLoading] = useState(true);
  const [broken, setBroken] = useState<StoredProjectError | null>(null);
  // Switching the language re-mounts the app, so every text is rebuilt in the new language.
  const lang = useLang();
  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    loadProject()
      .catch((e: unknown) => {
        // The saved plan is unusable: offer to download it instead of crashing on every start.
        if (e instanceof StoredProjectError && !cancelled) setBroken(e);
        return undefined;
      })
      .then((p) => {
        if (cancelled || p === undefined) return;
        useProject.getState().setLoaded(p);
        track('app_start', { lang: getLang(), tier: getTier(), projects: band(p ? 1 : 0) });
        void useProjects.getState().refresh();
        // Reopen the area that was open last time.
        const last = readLastArea();
        if (last && p?.areas.some((a) => a.id === last)) useProject.getState().selectArea(last);
        setLoading(false);
        // Autosave every project change after the initial load.
        unsub = useProject.subscribe((s, prev) => {
          if (s.project && s.project !== prev.project) {
            autosave.schedule(s.project);
            // A brand-new or freshly loaded project is written at once, not after the debounce.
            if (!prev.project || s.project.id !== prev.project.id) {
              setCurrentProjectId(s.project.id);
              autosave.flush();
            }
          }
          if (s.currentAreaId !== prev.currentAreaId) writeLastArea(s.currentAreaId);
        });
      });
    const onVis = () => document.visibilityState === 'hidden' && autosave.flush();
    const onHide = () => autosave.flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelled = true;
      unsub();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);
  if (broken) return <RecoveryScreen message={broken.message} data={broken.raw} />;
  return (
    <ErrorBoundary key={lang}>
      <App loading={loading} />
    </ErrorBoundary>
  );
}

const LAST_AREA = 'kerttervezo:last-area';
function readLastArea() {
  try {
    return localStorage.getItem(LAST_AREA);
  } catch {
    return null;
  }
}
function writeLastArea(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_AREA, id);
  } catch {
    /* per-device convenience only */
  }
}

function ReadOnlyRoot({ code }: { code: string }) {
  const lang = useLang();
  return (
    <Suspense fallback={null}>
      <ReadOnlyView key={lang} code={code} />
    </Suspense>
  );
}

// Look for a new version on start, whenever the app comes back to the foreground and every half hour;
// with autoUpdate the page reloads itself once the new version is ready (installed phone apps keep
// the old one for a long time otherwise).
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => {
      if (navigator.onLine !== false) reg.update().catch(() => {});
    };
    window.setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  },
});

// A share link (#view=…) opens the read-only page and never touches the local plan.
const share = location.hash.startsWith(SHARE_PREFIX) ? location.hash.slice(SHARE_PREFIX.length) : null;

// The visible height (without Safari's address bar); sheets size themselves to it.
const setVisibleH = () => document.documentElement.style.setProperty('--visible-h', `${Math.round(window.visualViewport?.height ?? window.innerHeight)}px`);
setVisibleH();
window.visualViewport?.addEventListener('resize', setVisibleH);
window.addEventListener('resize', setVisibleH);

createRoot(document.getElementById('root')!).render(<StrictMode>{share ? <ReadOnlyRoot code={share} /> : <Root />}</StrictMode>);
