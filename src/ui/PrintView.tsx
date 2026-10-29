import { StaticPlan } from "../canvas/StaticPlan";
import { buildBom, chosenItems, fmtFt, fmtInt } from "../engine/bom";
import { evaluate, partition, RULE_LABEL } from "../engine/rules";
import {
  MONTH_LABEL,
  SEASON_LABEL,
  SEASON_MONTH,
  type Season,
} from "../engine/season";
import { JUGLONE_LABEL, SUN_LABEL, WATER_LABEL } from "../model/plants";
import { ORIENTATION_LABEL, type Project } from "../model/types";
import { areaSunLevel } from "../engine/rules";
import type { Orientation } from "./ProjectPanel";

/**
 * Print-only document (SPEC §4.9): one section per area with plan, four seasons, plant list and
 * warnings, from the chosen variants. Shown only under @media print.
 */
export function PrintView({
  project,
  orientation,
}: {
  project: Project;
  orientation: Orientation;
}) {
  const date = new Date().toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const total = buildBom(project);
  return (
    <div className={`print-root print-${orientation}`}>
      {/* The page size follows the chosen orientation. */}
      <style>{`@page { size: A4 ${orientation}; margin: 12mm 12mm 14mm; }`}</style>
      {project.areas.map((area) => {
        const v =
          area.variants.find((x) => x.id === area.chosenVariantId) ??
          area.variants[0];
        const items = chosenItems(area);
        const bom = buildBom(project, [area.id]);
        const { active } = partition(
          evaluate(area, items, project.plantDb, project.settings),
          v.muted,
        );
        return (
          <section key={area.id} className="print-page">
            <header className="print-head">
              <div>
                <div className="eyebrow">
                  {project.name} · {date}
                </div>
                <h1>{area.name}</h1>
                <p className="mono">
                  {area.widthCm} × {area.lengthCm} cm ·{" "}
                  {ORIENTATION_LABEL[area.orientation]} ·{" "}
                  {SUN_LABEL[areaSunLevel(area)]}
                  {area.sunUntil ? ` (napos ${area.sunUntil})` : ""} · változat:{" "}
                  {v.name}
                </p>
              </div>
              <dl className="print-kpi">
                <dt>Tő</dt>
                <dd>{fmtInt(bom.planted)}</dd>
                <dt>Rendelés</dt>
                <dd>{fmtInt(bom.order)} db</dd>
                <dt>Költség</dt>
                <dd>{fmtFt(bom.total)}</dd>
              </dl>
            </header>

            <div className="print-plans">
              <figure className="print-main">
                <StaticPlan
                  area={area}
                  items={items}
                  plantDb={project.plantDb}
                  showMature={project.settings.showMatureSize}
                  labelPx={260}
                />
                <figcaption className="mono">
                  Felülnézet a választott változatból
                </figcaption>
              </figure>
              <div className="print-seasons">
                {([0, 1, 2, 3] as Season[]).map((s) => (
                  <figure key={s}>
                    <StaticPlan
                      area={area}
                      items={items}
                      plantDb={project.plantDb}
                      month={SEASON_MONTH[s]}
                      showMature={project.settings.showMatureSize}
                      labelPx={120}
                    />
                    <figcaption>
                      <b>{SEASON_LABEL[s]}</b>{" "}
                      <span className="mono">
                        {MONTH_LABEL[SEASON_MONTH[s] - 1]}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div className="print-bottom">
              {bom.rows.length > 0 ? (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Kód</th>
                      <th>Növény</th>
                      <th className="n">Ültet.</th>
                      <th className="n">Rend.</th>
                      <th>Kiszer.</th>
                      <th className="n">Max.</th>
                      <th className="n">Tőtáv</th>
                      <th>Víz</th>
                      <th>Juglone</th>
                      <th className="n">Egységár</th>
                      <th className="n">Részösszeg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bom.rows.map((r) => (
                      <tr key={r.plant.code}>
                        <td>
                          <span
                            className="print-code"
                            style={{ background: r.plant.color }}
                          />
                          {r.plant.code}
                        </td>
                        <td>
                          {r.plant.nameHu}
                          {r.plant.isTree ? " (fa)" : ""}{" "}
                          <i>{r.plant.nameLat}</i>
                        </td>
                        <td className="n">{r.planted}</td>
                        <td className="n">
                          <b>{r.order}</b>
                        </td>
                        <td>{r.plant.pot}</td>
                        <td className="n">{r.plant.maxHeightCm}</td>
                        <td className="n">{r.plant.spacingCm}</td>
                        <td>{WATER_LABEL[r.plant.water]}</td>
                        <td>{JUGLONE_LABEL[r.plant.juglone]}</td>
                        <td className="n">
                          {r.plant.unitPriceHuf
                            ? fmtInt(r.plant.unitPriceHuf)
                            : "–"}
                        </td>
                        <td className="n">{fmtInt(r.subtotal)}</td>
                      </tr>
                    ))}
                    <tr className="tot">
                      <td />
                      <td>
                        Összesen (rendelés +{project.settings.reservePct}%, fák
                        tartalék nélkül)
                      </td>
                      <td className="n">{bom.planted}</td>
                      <td className="n">{bom.order}</td>
                      <td colSpan={6} />
                      <td className="n">{fmtInt(bom.total)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p>Ebben a változatban még nincs növény.</p>
              )}

              <div className="print-warn">
                <h2>Figyelmeztetések</h2>
                {active.length === 0 ? (
                  <p>Nincs figyelmeztetés.</p>
                ) : (
                  <ul>
                    {active.map((w) => (
                      <li key={w.id} className={`sev-${w.severity}`}>
                        <b>{RULE_LABEL[w.rule]}:</b> {w.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        );
      })}
      {project.areas.length > 1 && (
        <section className="print-page print-summary">
          <h1>Összesítés</h1>
          <p className="mono">
            {fmtInt(total.planted)} tő · rendelés {fmtInt(total.order)} db ·{" "}
            {fmtFt(total.total)}
            {total.estimated ? ` · ${total.estimated} tétel ára becslés` : ""}
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th>Növény</th>
                {project.areas.map((a) => (
                  <th key={a.id} className="n">
                    {a.name}
                  </th>
                ))}
                <th className="n">Ültet.</th>
                <th className="n">Rend.</th>
                <th className="n">Részösszeg</th>
              </tr>
            </thead>
            <tbody>
              {total.rows.map((r) => (
                <tr key={r.plant.code}>
                  <td>
                    {r.plant.code} {r.plant.nameHu}
                  </td>
                  {project.areas.map((a) => (
                    <td key={a.id} className="n">
                      {r.byArea[a.id] ?? "–"}
                    </td>
                  ))}
                  <td className="n">{r.planted}</td>
                  <td className="n">
                    <b>{r.order}</b>
                  </td>
                  <td className="n">{fmtInt(r.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
