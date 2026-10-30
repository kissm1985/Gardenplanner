import { useMemo, useState } from "react";
import { fmtFt } from "../engine/bom";
import { variantStats } from "../engine/compare";
import {
  moveTargets,
  variantCount,
  variantTree,
  type TreeNode,
} from "../model/variantTree";
import type { Area } from "../model/types";
import {
  activeVariant,
  selectCurrentArea,
  useProject,
} from "../store/projectStore";
import { useUi } from "../store/uiStore";
import { t } from '../i18n';

type Stats = ReturnType<typeof variantStats>;

/** Plan variants of the current area as a tree: open, choose, copy, rename, move, group in folders, compare. */
export function VariantsPanel({
  onDone,
  onIdeas,
  onReplace,
  onVisual,
}: {
  onDone: () => void;
  onIdeas: () => void;
  onReplace: () => void;
  onVisual: () => void;
}) {
  const project = useProject((s) => s.project)!;
  const area = useProject(selectCurrentArea);
  const stats = useMemo(
    () =>
      new Map(
        area
          ? area.variants.map(
              (v) => [v.id, variantStats(project, area, v)] as const,
            )
          : [],
      ),
    [project, area],
  );
  if (!area) return null;
  const st = useProject.getState();
  const tree = variantTree(area);

  return (
    <div className="form">
      <p className="mono muted">
        {t(
          "A „választott” változatból készül a növénylista és a nyomtatás. A rajzon mindig a „szerkesztett” változatot látod. A másolat az eredeti alá kerül; mappákkal és áthelyezéssel rendezheted a fát.",
          "The plant list and the printout come from the “chosen” variant. The plan always shows the “edited” variant. A copy goes under its original; arrange the tree with folders and moves.",
        )}
      </p>
      <ul className="variant-tree" role="tree" aria-label={t("Változatok", "Variants")}>
        {tree.map((n) => (
          <Node key={n.id} n={n} area={area} stats={stats} onDone={onDone} />
        ))}
      </ul>
      <div className="form-actions">
        <button
          type="button"
          className="btn"
          onClick={() => st.addEmptyVariant()}
        >
          {t("+ Üres változat", "+ Empty variant")}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const name = prompt(t("Az új mappa neve:", "Name of the new folder:"), t("Mappa", "Folder"));
            if (name) st.addVariantFolder(name);
          }}
        >
          {t("+ Mappa", "+ Folder")}
        </button>
        <button type="button" className="btn" onClick={onIdeas}>
          {t("✦ Ötlet generálása", "✦ Generate an idea")}
        </button>
        <button type="button" className="btn" onClick={onReplace}>
          {t("⇄ Növény cseréje", "⇄ Replace plants")}
        </button>
        <button type="button" className="btn" onClick={onVisual}>
          {t("🖼 Látványterv", "🖼 Visualisation")}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={area.variants.length < 2}
          onClick={() => {
            useUi.getState().setTool("select");
            useUi.getState().setCompare(true);
            onDone();
          }}
        >
          {t("Összehasonlítás", "Compare")}
        </button>
      </div>
    </div>
  );
}

function Node({
  n,
  area,
  stats,
  onDone,
}: {
  n: TreeNode;
  area: Area;
  stats: Map<string, Stats>;
  onDone: () => void;
}) {
  const collapsed = useUi((s) => s.collapsed.includes(n.id));
  const toggle = useUi((s) => s.toggleCollapsed);
  const [mode, setMode] = useState<null | "rename" | "move">(null);
  const [menu, setMenu] = useState(false);
  const more = (
    <button
      type="button"
      className="tree-more"
      onClick={() => setMenu(!menu)}
      aria-label={t(`${n.name}: műveletek`, `${n.name}: actions`)}
      aria-expanded={menu}
    >
      ⋯
    </button>
  );
  const st = useProject.getState();
  const kids = n.children.length;
  const open = kids > 0 && !collapsed;
  const active = activeVariant(area).id;

  const caret = kids ? (
    <button
      type="button"
      className="tree-caret"
      onClick={() => toggle(n.id)}
      aria-label={collapsed ? t(`${n.name} kinyitása`, `Expand ${n.name}`) : t(`${n.name} becsukása`, `Collapse ${n.name}`)}
      aria-expanded={!collapsed}
    >
      {collapsed ? "▸" : "▾"}
    </button>
  ) : (
    <span className="tree-caret" aria-hidden="true" />
  );
  const hidden =
    collapsed && kids ? (
      <span className="mono muted tree-hidden">{t(`${variantCount(n)} változat`, `${variantCount(n)} variants`)}</span>
    ) : null;
  const rename = mode === "rename" && (
    <RenameField
      name={n.name}
      label={n.kind === "folder" ? t("Mappa neve", "Folder name") : t("Változat neve", "Variant name")}
      onSave={(name) =>
        n.kind === "folder"
          ? st.renameVariantFolder(n.id, name)
          : st.renameVariant(n.id, name)
      }
      onDone={() => setMode(null)}
    />
  );
  const move = mode === "move" && (
    <label className="field tree-move">
      <span className="lbl">{t("Áthelyezés ide", "Move to")}</span>
      <select
        autoFocus
        value={
          (n.kind === "folder" ? n.folder.parentId : n.variant.parentId) ?? ""
        }
        onChange={(e) => {
          st.moveVariantNode(n.id, e.target.value || null);
          setMode(null);
        }}
        onBlur={() => setMode(null)}
      >
        {moveTargets(area, n.id).map((t) => (
          <option key={t.id ?? ""} value={t.id ?? ""}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
  const children = open && (
    <ul className="variant-tree" role="group">
      {n.children.map((c) => (
        <Node key={c.id} n={c} area={area} stats={stats} onDone={onDone} />
      ))}
    </ul>
  );

  if (n.kind === "folder")
    return (
      <li
        role="treeitem"
        aria-expanded={kids ? open : undefined}
        className="tree-item"
      >
        <div className="variant-card variant-folder">
          <div className="variant-top">
            {caret}
            {rename || <b className="variant-name">📁 {n.name}</b>}
            {hidden}
            {more}
          </div>
          {move}
          {menu && (
            <div className="card-actions wrap">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setMode("rename")}
              >
                {t("Átnevezés", "Rename")}
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setMode("move")}
              >
                {t("Áthelyezés", "Move")}
              </button>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() =>
                  confirm(
                    t(
                      `Törlöd a(z) „${n.name}” mappát? A benne lévő változatok megmaradnak, egy szinttel feljebb kerülnek.`,
                      `Delete the folder “${n.name}”? Its variants stay and move up one level.`,
                    ),
                  ) && st.deleteVariantFolder(n.id)
                }
              >
                {t("Mappa törlése", "Delete folder")}
              </button>
            </div>
          )}
        </div>
        {children}
      </li>
    );

  const v = n.variant;
  const s = stats.get(v.id);
  return (
    <li
      role="treeitem"
      aria-expanded={kids ? open : undefined}
      className="tree-item"
    >
      <div className={`variant-card${v.id === active ? " is-active" : ""}`}>
        <div className="variant-top">
          {caret}
          {rename || <b className="variant-name">{v.name}</b>}
          <span className="variant-badges">
            {v.id === area.chosenVariantId && (
              <span className="badge badge-chosen">{t("★ választott", "★ chosen")}</span>
            )}
            {v.id === active && <span className="badge">{t("szerkesztett", "edited")}</span>}
          </span>
          {v.id !== active && (
            <button
              type="button"
              className="btn btn-small btn-primary tree-open"
              onClick={() => {
                st.setActiveVariant(v.id);
                onDone();
              }}
            >
              {t("Megnyitás", "Open")}
            </button>
          )}
          {more}
        </div>
        {s && (
          <span className="mono muted">
            {t(`${s.bom.planted} tő`, `${s.bom.planted} plants`)} · {fmtFt(s.bom.total)} ·{" "}
            {t(`${s.warnings.length} figyelmeztetés`, `${s.warnings.length} warnings`)}
            {s.errors ? t(` (${s.errors} hiba)`, ` (${s.errors} errors)`) : ""}
            {v.renders?.length ? ` · 🖼 ${v.renders.length}` : ""}
            {hidden && <> · </>}
            {hidden}
          </span>
        )}
        {move}
        {menu && (
          <div className="card-actions wrap">
            {v.id !== area.chosenVariantId && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => st.setChosenVariant(v.id)}
              >
                {t("Legyen a választott", "Make it the chosen one")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-small"
              onClick={() => st.duplicateVariant(v.id)}
            >
              {t("Másolás", "Copy")}
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setMode("rename")}
            >
              {t("Átnevezés", "Rename")}
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setMode("move")}
            >
              {t("Áthelyezés", "Move")}
            </button>
            {area.variants.length > 1 && (
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() =>
                  confirm(
                    t(
                      `Törlöd a(z) „${v.name}” változatot?${kids ? " Az alatta lévők egy szinttel feljebb kerülnek." : ""} Visszavonással visszahozható.`,
                      `Delete the variant “${v.name}”?${kids ? " The ones below it move up one level." : ""} Undo brings it back.`,
                    ),
                  ) && st.deleteVariant(v.id)
                }
              >
                {t("Törlés", "Delete")}
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </li>
  );
}

function RenameField({
  name: initial,
  label,
  onSave,
  onDone,
}: {
  name: string;
  label: string;
  onSave: (name: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial);
  const save = () => {
    onSave(name);
    onDone();
  };
  return (
    <input
      className="variant-rename"
      value={name}
      autoFocus
      onChange={(e) => setName(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") onDone();
      }}
      aria-label={label}
    />
  );
}
