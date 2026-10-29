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

type Stats = ReturnType<typeof variantStats>;

/** Plan variants of the current area as a tree: open, choose, copy, rename, move, group in folders, compare. */
export function VariantsPanel({
  onDone,
  onIdeas,
  onReplace,
}: {
  onDone: () => void;
  onIdeas: () => void;
  onReplace: () => void;
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
        A „választott” változatból készül a növénylista és a nyomtatás. A rajzon
        mindig a „szerkesztett” változatot látod. A másolat az eredeti alá
        kerül; mappákkal és áthelyezéssel rendezheted a fát.
      </p>
      <ul className="variant-tree" role="tree" aria-label="Változatok">
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
          + Üres változat
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const name = prompt("Az új mappa neve:", "Mappa");
            if (name) st.addVariantFolder(name);
          }}
        >
          + Mappa
        </button>
        <button type="button" className="btn" onClick={onIdeas}>
          ✦ Ötlet generálása
        </button>
        <button type="button" className="btn" onClick={onReplace}>
          ⇄ Növény cseréje
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
          Összehasonlítás
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
      aria-label={`${n.name}: műveletek`}
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
      aria-label={collapsed ? `${n.name} kinyitása` : `${n.name} becsukása`}
      aria-expanded={!collapsed}
    >
      {collapsed ? "▸" : "▾"}
    </button>
  ) : (
    <span className="tree-caret" aria-hidden="true" />
  );
  const hidden =
    collapsed && kids ? (
      <span className="mono muted tree-hidden">{variantCount(n)} változat</span>
    ) : null;
  const rename = mode === "rename" && (
    <RenameField
      name={n.name}
      label={n.kind === "folder" ? "Mappa neve" : "Változat neve"}
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
      <span className="lbl">Áthelyezés ide</span>
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
                Átnevezés
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setMode("move")}
              >
                Áthelyezés
              </button>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() =>
                  confirm(
                    `Törlöd a(z) „${n.name}” mappát? A benne lévő változatok megmaradnak, egy szinttel feljebb kerülnek.`,
                  ) && st.deleteVariantFolder(n.id)
                }
              >
                Mappa törlése
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
              <span className="badge badge-chosen">★ választott</span>
            )}
            {v.id === active && <span className="badge">szerkesztett</span>}
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
              Megnyitás
            </button>
          )}
          {more}
        </div>
        {s && (
          <span className="mono muted">
            {s.bom.planted} tő · {fmtFt(s.bom.total)} · {s.warnings.length}{" "}
            figyelmeztetés{s.errors ? ` (${s.errors} hiba)` : ""}
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
                Legyen a választott
              </button>
            )}
            <button
              type="button"
              className="btn btn-small"
              onClick={() => st.duplicateVariant(v.id)}
            >
              Másolás
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setMode("rename")}
            >
              Átnevezés
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setMode("move")}
            >
              Áthelyezés
            </button>
            {area.variants.length > 1 && (
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() =>
                  confirm(
                    `Törlöd a(z) „${v.name}” változatot?${kids ? " Az alatta lévők egy szinttel feljebb kerülnek." : ""} Visszavonással visszahozható.`,
                  ) && st.deleteVariant(v.id)
                }
              >
                Törlés
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
