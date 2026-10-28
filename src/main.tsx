import '@fontsource-variable/fraunces';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/tokens.css';
import './styles/app.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
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
      setLoading(false);
      // Autosave every project change after the initial load.
      unsub = useProject.subscribe((s, prev) => {
        if (s.project && s.project !== prev.project) autosave.schedule(s.project);
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

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
