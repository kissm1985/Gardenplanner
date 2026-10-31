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
import { locale, t } from '../i18n';
import { localName } from '../i18n/names';
import { plantName } from '../model/plants';

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
  const date = new Date().toLocaleDateString(locale(), {
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
                  {localName(project.name)} · {date}
                </div>
                <h1>{localName(area.name)}</h1>
                <p className="mono">
                  {area.widthCm} × {area.lengthCm} cm ·{" "}
                  {ORIENTATION_LABEL[area.orientation]} ·{" "}
                  {SUN_LABEL[areaSunLevel(area)]}
                  {area.sunUntil ? t(` (napos ${area.sunUntil})`, ` (sun ${area.sunUntil})`) : ""} ·{" "}
                  {t("változat", "variant")}: {localName(v.name)}
                </p>
              </div>
              <dl className="print-kpi">
                <dt>{t("Tő", "Plants")}</dt>
                <dd>{fmtInt(bom.planted)}</dd>
                <dt>{t("Rendelés", "Order")}</dt>
                <dd>{t(`${fmtInt(bom.order)} db`, `${fmtInt(bom.order)}`)}</dd>
                <dt>{t("Költség", "Cost")}</dt>
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
                  {t("Felülnézet", "Plan view")}
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
                      <th>{t("Kód", "Code")}</th>
                      <th>{t("Növény", "Plant")}</th>
                      <th className="n">{t("Ültet.", "Plant")}</th>
                      <th className="n">{t("Rend.", "Order")}</th>
                      <th>{t("Kiszer.", "Pot")}</th>
                      <th className="n">Max.</th>
                      <th className="n">{t("Tőtáv", "Spacing")}</th>
                      <th>{t("Víz", "Water")}</th>
                      <th>Juglone</th>
                      <th className="n">{t("Egységár", "Unit price")}</th>
                      <th className="n">{t("Részösszeg", "Subtotal")}</th>
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
                          {plantName(r.plant)}
                          {r.plant.isTree ? t(" (fa)", " (tree)") : ""}{" "}
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
                        {t(
                          `Összesen (rendelés +${project.settings.reservePct}%, fák tartalék nélkül)`,
                          `Total (order +${project.settings.reservePct}%, trees without spare)`,
                        )}
                      </td>
                      <td className="n">{bom.planted}</td>
                      <td className="n">{bom.order}</td>
                      <td colSpan={6} />
                      <td className="n">{fmtInt(bom.total)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p>{t("Ebben a változatban még nincs növény.", "No plants in this variant yet.")}</p>
              )}

              <div className="print-warn">
                <h2>{t("Figyelmeztetések", "Warnings")}</h2>
                {active.length === 0 ? (
                  <p>{t("Nincs figyelmeztetés.", "No warnings.")}</p>
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
          <h1>{t("Összesítés", "Summary")}</h1>
          <p className="mono">
            {t(`${fmtInt(total.planted)} tő · rendelés ${fmtInt(total.order)} db`, `${fmtInt(total.planted)} plants · order ${fmtInt(total.order)}`)} ·{" "}
            {fmtFt(total.total)}
            {total.estimated ? t(` · ${total.estimated} tétel ára becslés`, ` · ${total.estimated} prices estimated`) : ""}
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th>{t("Növény", "Plant")}</th>
                {project.areas.map((a) => (
                  <th key={a.id} className="n">
                    {localName(a.name)}
                  </th>
                ))}
                <th className="n">{t("Ültet.", "Plant")}</th>
                <th className="n">{t("Rend.", "Order")}</th>
                <th className="n">{t("Részösszeg", "Subtotal")}</th>
              </tr>
            </thead>
            <tbody>
              {total.rows.map((r) => (
                <tr key={r.plant.code}>
                  <td>
                    {r.plant.code} {plantName(r.plant)}
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
