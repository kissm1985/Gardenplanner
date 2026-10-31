import { useMemo, useRef, useState } from 'react';
import { careCalendar, plantsInPlan } from '../engine/care';
import { buildSchedule, defaultWindow, fromIso, mulchAdvice, type Day } from '../engine/schedule';
import { MONTH_LABEL } from '../engine/season';
import type { Plant } from '../model/types';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { copy } from './clipboard';
import { PlantChip } from './PlantChip';
import { locale, t } from '../i18n';
import { gardenLocation } from '../model/location';
import { plantName } from '../model/plants';

type Tab = 'plant' | 'care' | 'mulch';

const dayLabel = (iso: string) =>
  fromIso(iso).toLocaleDateString(locale(), { month: 'short', day: 'numeric', weekday: 'long' });

/** Planting schedule, monthly care calendar and mulch advice (SPEC §4.7). */
export function SchedulePage() {
  const [tab, setTab] = useState<Tab>('plant');
  return (
    <div className="schedule">
      <header className="cmp-head">
        <div className="eyebrow">{t('Menetrend és gondozás · a rajzon lévő tervekből', 'Schedule and care · from the plans on screen')}</div>
        <div className="seg" role="tablist" aria-label={t('Nézet', 'View')}>
          {(
            [
              ['plant', t('Ültetési menetrend', 'Planting schedule')],
              ['care', t('Gondozási naptár', 'Care calendar')],
              ['mulch', t('Mulcs', 'Mulch')],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" className="chip-btn" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-small" onClick={() => useUi.getState().setPage(null)}>
          {t('← Vissza a tervhez', '← Back to the plan')}
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
  const doneCount = all.filter((tk) => done.has(tk.id)).length;
  const [toast, setToast] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const st = useProject.getState();

  const apply = () => {
    if (!start || !end || end < start) return setToast(t('A záró dátum ne legyen a kezdő előtt.', 'The end date must not be before the start date.'));
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
          <span>{t('Kezdés', 'Start')}</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Befejezés', 'End')}</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={start === win.start && end === win.end}>
          {t('Menetrend készítése', 'Make the schedule')}
        </button>
      </div>
      {toast && (
        <p className="form-error" role="alert">
          {toast}
        </p>
      )}
      <div className="sched-progress" aria-label={t(`${doneCount} / ${all.length} kész`, `${doneCount} / ${all.length} done`)}>
        <div className="bar">
          <i style={{ width: all.length ? `${(doneCount / all.length) * 100}%` : 0 }} />
        </div>
        <span className="mono">
          {t(
            `${doneCount} / ${all.length} kész · kb. ${plan.hours.toLocaleString(locale())} munkaóra`,
            `${doneCount} / ${all.length} done · about ${plan.hours.toLocaleString(locale())} working hours`,
          )}
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
              <p className="mono muted">{t('Tartaléknap (eső, késő szállítás).', 'Spare day (rain, late delivery).')}</p>
            ) : (
              <ul className="tasks">
                {d.tasks.map((tk) => (
                  <li key={tk.id}>
                    <label className={`task${done.has(tk.id) ? ' is-done' : ''}`}>
                      <input type="checkbox" checked={done.has(tk.id)} onChange={() => toggle(tk.id)} />
                      <span>
                        <b>{tk.title}</b>
                        {tk.detail && <small>{tk.detail}</small>}
                        <small className="mono">~{t(`${tk.hours.toLocaleString(locale())} óra`, `${tk.hours.toLocaleString(locale())} h`)}</small>
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
            setToast(ok ? '' : t('A másolás itt nem működik: jelöld ki a lenti mezőt.', 'Copying does not work here: select the box below.'));
          }}
        >
          {t('Menetrend másolása szövegként', 'Copy the schedule as text')}
        </button>
      </div>
      <textarea ref={taRef} className="sched-text" readOnly rows={4} value={text} aria-label={t('Menetrend szövegként', 'Schedule as text')} onFocus={(e) => e.currentTarget.select()} />
    </section>
  );
}

export function scheduleText(days: Day[], done: Set<string>): string {
  return days
    .filter((d) => d.tasks.length)
    .map((d) => [dayLabel(d.date), ...d.tasks.map((tk) => `  [${done.has(tk.id) ? 'x' : ' '}] ${tk.title}`)].join('\n'))
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
      <p className="mono muted">
        {t(
          `Magyarországi éghajlatra írt naptár (${gardenLocation(project.settings).name}); a helyszín a Projekt ablakban állítható. Csak a tervben szereplő fajok jelennek meg.`,
          `Calendar written for the Hungarian climate (${gardenLocation(project.settings).name}); set the location in the Project window. Only species in the plan are shown.`,
        )}
      </p>
      <ol className="months-cal">
        {order.map((m) => (
          <li key={m} className={`month-card${m === now ? ' is-now' : ''}`}>
            <h3>
              <span className="month-name">{MONTH_LABEL[m]}</span>
              {m === now && <span className="badge badge-chosen">{t('most', 'now')}</span>}
            </h3>
            <ul>
              {cal[m].map((tk) => (
                <li key={tk.text}>
                  {tk.codes.length > 0 && (
                    <span className="care-chips">
                      {tk.codes.slice(0, 6).map((c) => byCode.get(c) && <PlantChip key={c} p={byCode.get(c)!} size={22} />)}
                    </span>
                  )}
                  <span>{tk.text}</span>
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
          <PlantChip p={p} size={26} /> {plantName(p)}
        </li>
      ))}
    </ul>
  );
  if (!m.gravel.length && !m.bark.length && !m.trees.length) return <p className="empty">{t('Még nincs növény a tervekben.', 'No plants in the plans yet.')}</p>;
  return (
    <section className="sched-tab mulch">
      {m.gravel.length > 0 && (
        <article className="mulch-card">
          <h3>{t('Világos apró kavics, 4–8 mm', 'Light fine gravel, 4–8 mm')}</h3>
          <p>
            {t(
              'A szárazságtűrő, napimádó fajok mellé kéreg helyett: nem tart nedvességet a tő körül, a levendula és a kakukkfű nem rothad, és visszaveri a fényt. 4–5 cm vastagon, agrotextilen.',
              'Instead of bark next to drought-tolerant, sun-loving species: it keeps no moisture around the crown, lavender and thyme do not rot, and it reflects light. 4–5 cm deep, on fabric.',
            )}
          </p>
          {list(m.gravel)}
        </article>
      )}
      {m.bark.length > 0 && (
        <article className="mulch-card">
          <h3>{t('Kéreg vagy komposztált kéreg', 'Bark or composted bark')}</h3>
          <p>
            {t(
              'A többi évelő mellé ~5 cm vastagon, a tövektől 3–5 cm-re. Ha az ágyás többi része kérget kap, a kavicsos fajok foltjai körül akkor is kavics maradjon.',
              'For the other perennials, ~5 cm deep, 3–5 cm from the stems. If the rest of the bed gets bark, keep gravel around the drifts of the gravel-loving species.',
            )}
          </p>
          {list(m.bark)}
        </article>
      )}
      {m.trees.length > 0 && (
        <article className="mulch-card">
          <h3>{t('Fák', 'Trees')}</h3>
          <p>{t('A törzs körül 60 cm átmérőben agrotextil nélkül; kéreggyűrű, ami nem ér a törzshöz.', 'No fabric within 60 cm around the trunk; a ring of bark that does not touch the trunk.')}</p>
          {list(m.trees)}
        </article>
      )}
    </section>
  );
}
