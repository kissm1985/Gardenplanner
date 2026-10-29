import { useMemo, useRef, useState } from 'react';
import { careCalendar, plantsInPlan } from '../engine/care';
import { buildSchedule, defaultWindow, fromIso, mulchAdvice, type Day } from '../engine/schedule';
import { MONTH_LABEL } from '../engine/season';
import type { Plant } from '../model/types';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { copy } from './clipboard';
import { PlantChip } from './PlantChip';

type Tab = 'plant' | 'care' | 'mulch';

const dayLabel = (iso: string) =>
  fromIso(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'long' });

/** Planting schedule, monthly care calendar and mulch advice (SPEC §4.7). */
export function SchedulePage() {
  const [tab, setTab] = useState<Tab>('plant');
  return (
    <div className="schedule">
      <header className="cmp-head">
        <div className="eyebrow">Menetrend és gondozás · a választott változatokból</div>
        <div className="seg" role="tablist" aria-label="Nézet">
          {(
            [
              ['plant', 'Ültetési menetrend'],
              ['care', 'Gondozási naptár'],
              ['mulch', 'Mulcs'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" className="chip-btn" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-small" onClick={() => useUi.getState().setPage(null)}>
          ← Vissza a tervhez
        </button>
      </header>
      {tab === 'plant' && <PlantingTab />}
      {tab === 'care' && <CareTab />}
      {tab === 'mulch' && <MulchTab />}
    </div>
  );
}

function PlantingTab() {
  const project = useProject((s) => s.project)!;
  const win = project.schedule ?? { ...defaultWindow(), done: [] };
  const [start, setStart] = useState(win.start);
  const [end, setEnd] = useState(win.end);
  const plan = useMemo(() => buildSchedule(project, win.start, win.end), [project, win.start, win.end]);
  const done = new Set(project.schedule?.done ?? []);
  const all = plan.days.flatMap((d) => d.tasks);
  const doneCount = all.filter((t) => done.has(t.id)).length;
  const [toast, setToast] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const st = useProject.getState();

  const apply = () => {
    if (!start || !end || end < start) return setToast('A záró dátum ne legyen a kezdő előtt.');
    setToast('');
    st.setScheduleWindow(start, end);
  };
  const toggle = (id: string) => {
    // The first tick also stores the (default) window, so ticks are never lost.
    if (!project.schedule) st.setScheduleWindow(win.start, win.end);
    st.toggleTask(id);
  };
  const text = scheduleText(plan.days, done);

  return (
    <section className="sched-tab">
      <div className="sched-window">
        <label className="field">
          <span>Kezdés</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>Befejezés</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={start === win.start && end === win.end}>
          Menetrend készítése
        </button>
      </div>
      {toast && (
        <p className="form-error" role="alert">
          {toast}
        </p>
      )}
      <div className="sched-progress" aria-label={`${doneCount} / ${all.length} kész`}>
        <div className="bar">
          <i style={{ width: all.length ? `${(doneCount / all.length) * 100}%` : 0 }} />
        </div>
        <span className="mono">
          {doneCount} / {all.length} kész · kb. {plan.hours.toLocaleString('hu-HU')} munkaóra
        </span>
      </div>
      {plan.notes.map((n) => (
        <p key={n} className="warn">
          {n}
        </p>
      ))}
      <ol className="days">
        {plan.days.map((d) => (
          <li key={d.date} className={`day${d.tasks.length ? '' : ' is-spare'}`}>
            <h3>{dayLabel(d.date)}</h3>
            {d.tasks.length === 0 ? (
              <p className="mono muted">Tartaléknap (eső, késő szállítás).</p>
            ) : (
              <ul className="tasks">
                {d.tasks.map((t) => (
                  <li key={t.id}>
                    <label className={`task${done.has(t.id) ? ' is-done' : ''}`}>
                      <input type="checkbox" checked={done.has(t.id)} onChange={() => toggle(t.id)} />
                      <span>
                        <b>{t.title}</b>
                        {t.detail && <small>{t.detail}</small>}
                        <small className="mono">~{t.hours.toLocaleString('hu-HU')} óra</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <div className="lv-tools">
        <button
          type="button"
          className="btn btn-small"
          onClick={async () => {
            const ok = await copy(text, taRef.current);
            setToast(ok ? '' : 'A másolás itt nem működik: jelöld ki a lenti mezőt.');
          }}
        >
          Menetrend másolása szövegként
        </button>
      </div>
      <textarea ref={taRef} className="sched-text" readOnly rows={4} value={text} aria-label="Menetrend szövegként" onFocus={(e) => e.currentTarget.select()} />
    </section>
  );
}

export function scheduleText(days: Day[], done: Set<string>): string {
  return days
    .filter((d) => d.tasks.length)
    .map((d) => [dayLabel(d.date), ...d.tasks.map((t) => `  [${done.has(t.id) ? 'x' : ' '}] ${t.title}`)].join('\n'))
    .join('\n\n');
}

function CareTab() {
  const project = useProject((s) => s.project)!;
  const cal = useMemo(() => careCalendar(project), [project]);
  const byCode = useMemo(() => new Map(project.plantDb.map((p) => [p.code, p])), [project.plantDb]);
  const now = new Date().getMonth();
  // Start with the current month.
  const order = Array.from({ length: 12 }, (_, i) => (now + i) % 12);
  return (
    <section className="sched-tab">
      <p className="mono muted">Győri éghajlat: utolsó fagy április közepe, első fagy október vége. Csak a tervben szereplő fajok jelennek meg.</p>
      <ol className="months-cal">
        {order.map((m) => (
          <li key={m} className={`month-card${m === now ? ' is-now' : ''}`}>
            <h3>
              <span className="month-name">{MONTH_LABEL[m]}</span>
              {m === now && <span className="badge badge-chosen">most</span>}
            </h3>
            <ul>
              {cal[m].map((t) => (
                <li key={t.text}>
                  {t.codes.length > 0 && (
                    <span className="care-chips">
                      {t.codes.slice(0, 6).map((c) => byCode.get(c) && <PlantChip key={c} p={byCode.get(c)!} size={22} />)}
                    </span>
                  )}
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MulchTab() {
  const project = useProject((s) => s.project)!;
  const m = useMemo(() => mulchAdvice(plantsInPlan(project)), [project]);
  const list = (ps: Plant[]) => (
    <ul className="mulch-list">
      {ps.map((p) => (
        <li key={p.code}>
          <PlantChip p={p} size={26} /> {p.nameHu}
        </li>
      ))}
    </ul>
  );
  if (!m.gravel.length && !m.bark.length && !m.trees.length) return <p className="empty">Még nincs növény a választott változatokban.</p>;
  return (
    <section className="sched-tab mulch">
      {m.gravel.length > 0 && (
        <article className="mulch-card">
          <h3>Világos apró kavics, 4–8 mm</h3>
          <p>A szárazságtűrő, napimádó fajok mellé kéreg helyett: nem tart nedvességet a tő körül, a levendula és a kakukkfű nem rothad, és visszaveri a fényt. 4–5 cm vastagon, agrotextilen.</p>
          {list(m.gravel)}
        </article>
      )}
      {m.bark.length > 0 && (
        <article className="mulch-card">
          <h3>Kéreg vagy komposztált kéreg</h3>
          <p>A többi évelő mellé ~5 cm vastagon, a tövektől 3–5 cm-re. Ha az ágyás többi része kérget kap, a kavicsos fajok foltjai körül akkor is kavics maradjon.</p>
          {list(m.bark)}
        </article>
      )}
      {m.trees.length > 0 && (
        <article className="mulch-card">
          <h3>Fák</h3>
          <p>A törzs körül 60 cm átmérőben agrotextil nélkül; kéreggyűrű, ami nem ér a törzshöz.</p>
          {list(m.trees)}
        </article>
      )}
    </section>
  );
}
