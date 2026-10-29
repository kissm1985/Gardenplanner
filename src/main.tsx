import '@fontsource-variable/fraunces';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/print.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { SHARE_PREFIX } from './engine/io';
import { ReadOnlyView } from './ui/ReadOnlyView';
import { createAutosaver, loadProject } from './store/persist';
import { useProject } from './store/projectStore';

const autosave = createAutosaver();
autosave.onError(() => {
  // Storage can fail (private mode, quota); keep working in memory and say so.
  document.documentElement.dataset.saveError = '1';
});

function Root() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    loadProject().then((p) => {
      if (cancelled) return;
      useProject.getState().setLoaded(p);
      // Reopen the area that was open last time.
      const last = readLastArea();
      if (last && p?.areas.some((a) => a.id === last)) useProject.getState().selectArea(last);
      setLoading(false);
      // Autosave every project change after the initial load.
      unsub = useProject.subscribe((s, prev) => {
        if (s.project && s.project !== prev.project) {
          autosave.schedule(s.project);
          // A brand-new or freshly loaded project is written at once, not after the debounce.
          if (!prev.project || s.project.id !== prev.project.id) autosave.flush();
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
  return <App loading={loading} />;
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

registerSW({ immediate: true });

// A share link (#view=…) opens the read-only page and never touches the local plan.
const share = location.hash.startsWith(SHARE_PREFIX) ? location.hash.slice(SHARE_PREFIX.length) : null;

createRoot(document.getElementById('root')!).render(<StrictMode>{share ? <ReadOnlyView code={share} /> : <Root />}</StrictMode>);
