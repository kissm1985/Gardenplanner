import { useState } from 'react';
import { AREA_TEMPLATES } from '../data/templates';
import { useProject } from '../store/projectStore';

/** First launch: offer the two starting templates (SPEC §4.1). */
export function Welcome() {
  const [picked, setPicked] = useState<string[]>(AREA_TEMPLATES.map((t) => t.key));
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  return (
    <main className="welcome">
      <div className="eyebrow">Kerttervező</div>
      <h1>Tervezzük meg a kertet</h1>
      <p className="lead">
        Rajzold meg a területet, húzd rá a növényeket, és az app összeállítja a listát. Minden adat ezen a készüléken marad.
      </p>
      <h2 className="sub-h">Mivel kezdjünk?</h2>
      <div className="tpl-list">
        {AREA_TEMPLATES.map((t) => (
          <label key={t.key} className={`tpl tpl-check${picked.includes(t.key) ? ' is-on' : ''}`}>
            <input type="checkbox" checked={picked.includes(t.key)} onChange={() => toggle(t.key)} />
            <b>{t.title}</b>
            <small>{t.summary}</small>
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-wide" onClick={() => useProject.getState().createProject(picked)}>
          {picked.length ? 'Kezdés a kiválasztott sablonokkal' : 'Kezdés üres projekttel'}
        </button>
      </div>
    </main>
  );
}
