import { memo, useMemo } from 'react';
import { StaticPlan } from '../canvas/StaticPlan';
import { buildExample, EXAMPLE_PLANS } from '../data/examples';
import { SEED_PLANTS } from '../data/plants.seed';
import { itemCount } from '../engine/fill';
import { getLang, t } from '../i18n';

/** The ten ready-made example plans on the start page, each with a small drawing of its planted plan. */
export const ExamplePlans = memo(function ExamplePlans({ onPick, strip = false }: { onPick: (key: string) => void; /** One scrollable row instead of a grid. */ strip?: boolean }) {
  const lang = getLang();
  // Built once per language: names and element labels are stored in the language of the moment.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt on purpose when the language changes
  const built = useMemo(() => EXAMPLE_PLANS.map((ex) => ({ ex, area: buildExample(ex) })), [lang]);
  return (
    <ul className={`example-list${strip ? ' example-strip' : ''}`}>
      {built.map(({ ex, area }) => {
        const v = area.variants[0];
        const n = v.items.reduce((s, it) => s + itemCount(it), 0);
        const species = new Set(v.items.map((it) => it.plantId)).size;
        const [name, blurb] = lang === 'en' ? [ex.name[1], ex.blurb[1]] : [ex.name[0], ex.blurb[0]];
        return (
          <li key={ex.key}>
            <button type="button" className="example-card" style={{ '--ex-accent': ex.accent } as React.CSSProperties} onClick={() => onPick(ex.key)} data-example={ex.key}>
              <span className="example-thumb" aria-hidden="true">
                <StaticPlan area={area} items={v.items} plantDb={SEED_PLANTS} title={name} />
              </span>
              <span className="example-text">
                <b>{name}</b>
                <span className="example-blurb">{blurb}</span>
                <small>
                  {area.widthCm / 100} × {area.lengthCm / 100} m · {t(`${species} faj`, `${species} species`)} · {t(`${n} tő`, `${n} plants`)}
                </small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
});
