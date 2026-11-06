// The project's areas on the start page, as cards with a small drawing of the plan on the canvas (like the
// example plans). Loaded on demand: the drawing code is not part of the start-up bundle.
import { StaticPlan } from '../canvas/StaticPlan';
import { itemCount } from '../engine/fill';
import { t } from '../i18n';
import { localName } from '../i18n/names';
import type { Project } from '../model/types';
import { activeVariant } from '../store/projectModel';

export function AreaCards({ project, onOpen }: { project: Project; onOpen: (id: string) => void }) {
  return (
    <ul className="example-list example-strip home-areas">
      {project.areas.map((a) => {
        const v = activeVariant(a);
        const n = v.items.reduce((s, it) => s + itemCount(it), 0);
        const name = localName(a.name);
        return (
          <li key={a.id}>
            <button type="button" className="example-card home-area" onClick={() => onOpen(a.id)}>
              <span className="example-thumb" aria-hidden="true">
                <StaticPlan area={a} items={v.items} plantDb={project.plantDb} title={name} />
              </span>
              <span className="example-text">
                <b>{name}</b>
                <span className="example-blurb">
                  {localName(v.name)}
                  {a.variants.length > 1 ? t(` · ${a.variants.length} változat`, ` · ${a.variants.length} variants`) : ''}
                </span>
                <small>
                  {a.widthCm / 100} × {a.lengthCm / 100} m · {t(`${n} tő`, `${n} plants`)}
                </small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
