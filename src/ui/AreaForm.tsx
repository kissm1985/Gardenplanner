import { useState, type FormEvent } from "react";
import type { AreaInput } from "../data/templates";
import { areaSunLevel } from "../engine/rules";
import { SOIL_LABEL, SOILS, SUN_LABEL } from "../model/plants";
import {
  DEFAULT_CONSTRAINTS,
  ORIENTATION_LABEL,
  type Area,
  type AreaKind,
  type Orientation,
  type Soil,
  type SunNeed,
  AREA_KIND_LABEL,
} from "../model/types";
import { ToxicNotice } from './Disclaimer';
import { t } from '../i18n';

type Draft = AreaInput & {
  constraints: Area["constraints"];
  sunLevel?: SunNeed;
  soil?: Soil;
  kind?: AreaKind;
  freeShape?: boolean;
};

const blank: Draft = {
  name: "",
  widthCm: 200,
  lengthCm: 400,
  orientation: "S",
  sunUntil: "",
  notes: "",
  constraints: { ...DEFAULT_CONSTRAINTS },
};

export function AreaForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Area;
  submitLabel: string;
  onSubmit: (d: Draft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() =>
    initial
      ? {
          name: initial.name,
          widthCm: initial.widthCm,
          lengthCm: initial.lengthCm,
          orientation: initial.orientation,
          sunUntil: initial.sunUntil,
          sunLevel: initial.sunLevel,
          soil: initial.soil,
          kind: initial.kind,
          notes: initial.notes,
          constraints: { ...initial.constraints },
        }
      : blank,
  );
  const [error, setError] = useState("");
  const polygon = initial?.shape.kind === "polygon";
  const [limits, setLimits] = useState(() =>
    Object.entries(d.constraints.speciesLimits)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", "),
  );
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((p) => ({ ...p, [k]: v }));
  const setC = <K extends keyof Draft["constraints"]>(
    k: K,
    v: Draft["constraints"][K],
  ) => setD((p) => ({ ...p, constraints: { ...p.constraints, [k]: v } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.name.trim())
      return setError(t("Adj nevet a területnek, például „Házoldali sáv”.", "Give the area a name, e.g. “Back garden”."));
    if (
      !(
        d.widthCm >= 10 &&
        d.widthCm <= 10000 &&
        d.lengthCm >= 10 &&
        d.lengthCm <= 10000
      )
    )
      return setError(t("A méret 10 és 10 000 cm között lehet.", "The size must be between 10 and 10 000 cm."));
    const parsed = parseLimits(limits);
    if (parsed == null)
      return setError(
        t("A fajonkénti korlát formája: kód: darab, pl. „LA: 12, TH: 40”.", "Species limits look like code: count, e.g. “LA: 12, TH: 40”."),
      );
    setError("");
    onSubmit({
      ...d,
      name: d.name.trim(),
      constraints: { ...d.constraints, speciesLimits: parsed },
    });
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span>{t("Név", "Name")}</span>
        <input
          value={d.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={t("pl. Házoldali sáv", "e.g. Back garden")}
          autoComplete="off"
        />
      </label>
      {!initial && (
        <fieldset className="field-group">
          <legend>{t("Alak", "Shape")}</legend>
          <div className="seg">
            <label className="seg-item">
              <input
                type="radio"
                name="shape"
                checked={!d.freeShape}
                onChange={() => set("freeShape", false)}
              />
              <span>{t("téglalap", "rectangle")}</span>
            </label>
            <label className="seg-item">
              <input
                type="radio"
                name="shape"
                checked={!!d.freeShape}
                onChange={() => set("freeShape", true)}
              />
              <span>{t("szabad alak – a terven rajzolom", "free shape – I draw it on the plan")}</span>
            </label>
          </div>
          {d.freeShape && (
            <p className="mono muted">
              {t(
                "Add meg nagyjából, mekkora helyen rajzolsz; utána a terven sarokpontonként rajzolod meg a területet.",
                "Give roughly how big the drawing space is; then you draw the area corner by corner on the plan.",
              )}
            </p>
          )}
        </fieldset>
      )}
      {polygon ? (
        <p className="mono muted">
          {t(
            `Szabad alakú terület (${d.widthCm} × ${d.lengthCm} cm befoglaló méret). Az alakot a terven az „Alak szerkesztése” gombbal módosíthatod.`,
            `Free-shape area (${d.widthCm} × ${d.lengthCm} cm bounding box). Change the shape on the plan with “Edit shape”.`,
          )}
        </p>
      ) : (
        <div className="field-row">
          <label className="field">
            <span>
              {d.freeShape ? t("Rajzterület szélessége (cm)", "Drawing space width (cm)") : t("Szélesség (cm)", "Width (cm)")}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={10}
              value={d.widthCm}
              onChange={(e) => set("widthCm", +e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              {d.freeShape ? t("Rajzterület hossza (cm)", "Drawing space length (cm)") : t("Hossz (cm)", "Length (cm)")}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={10}
              value={d.lengthCm}
              onChange={(e) => set("lengthCm", +e.target.value)}
            />
          </label>
        </div>
      )}
      <label className="field">
        <span>{t("Területtípus", "Area type")}</span>
        <select
          value={d.kind ?? "bed"}
          onChange={(e) => set("kind", e.target.value as AreaKind)}
        >
          {(Object.keys(AREA_KIND_LABEL) as AreaKind[]).map((k) => (
            <option key={k} value={k}>
              {AREA_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t("Égtáj", "Facing")}</span>
          <select
            value={d.orientation}
            onChange={(e) => set("orientation", e.target.value as Orientation)}
          >
            {(Object.keys(ORIENTATION_LABEL) as Orientation[]).map((o) => (
              <option key={o} value={o}>
                {ORIENTATION_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("Napsütés", "Sun")}</span>
          <input
            value={d.sunUntil}
            onChange={(e) => set("sunUntil", e.target.value)}
            placeholder={t("pl. 13:00-ig", "e.g. until 13:00")}
          />
        </label>
      </div>

      <label className="field">
        <span>{t("Napfény a szabályokhoz", "Light for the rules")}</span>
        <select
          value={d.sunLevel ?? ""}
          onChange={(e) =>
            set(
              "sunLevel",
              (e.target.value || undefined) as SunNeed | undefined,
            )
          }
        >
          <option value="">
            {t("automatikus", "automatic")} (
            {
              SUN_LABEL[
                areaSunLevel({
                  ...(initial ?? ({} as Area)),
                  ...d,
                  sunLevel: undefined,
                  shape: { kind: "rect" },
                } as Area)
              ]
            }
            )
          </option>
          {(Object.keys(SUN_LABEL) as SunNeed[]).map((k) => (
            <option key={k} value={k}>
              {SUN_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t("Talaj", "Soil")}</span>
        <select
          value={d.soil ?? ""}
          onChange={(e) =>
            set("soil", (e.target.value || undefined) as Soil | undefined)
          }
        >
          <option value="">{t("nincs megadva", "not set")}</option>
          {SOILS.map((k) => (
            <option key={k} value={k}>
              {SOIL_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="field-group">
        <legend>{t("Korlátok", "Limits")}</legend>
        <label className="field">
          <span>{t("Max. magasság (cm, üresen: nincs)", "Max. height (cm, empty: none)")}</span>
          <input
            type="number"
            inputMode="numeric"
            value={d.constraints.maxHeightCm ?? ""}
            onChange={(e) =>
              setC(
                "maxHeightCm",
                e.target.value === "" ? null : +e.target.value,
              )
            }
          />
        </label>
        <label className="field">
          <span>{t("Max. fák száma (üresen: nincs)", "Max. number of trees (empty: none)")}</span>
          <input
            type="number"
            inputMode="numeric"
            value={d.constraints.maxTrees ?? ""}
            onChange={(e) =>
              setC("maxTrees", e.target.value === "" ? null : +e.target.value)
            }
          />
        </label>
        <label className="field">
          <span>{t("Fajonkénti korlát (pl. LA: 12, TH: 40)", "Limit per species (e.g. LA: 12, TH: 40)")}</span>
          <input
            value={limits}
            onChange={(e) => setLimits(e.target.value)}
            autoCapitalize="characters"
          />
        </label>
        <Check
          label={t("Tüskementes legyen", "No thorns")}
          v={d.constraints.noThorns}
          on={(v) => setC("noThorns", v)}
        />
        <Check
          label={t("Nem mérgező legyen", "Non-toxic only")}
          v={d.constraints.nonToxic}
          on={(v) => setC("nonToxic", v)}
        />
        {d.constraints.nonToxic && <ToxicNotice />}
        <Check
          label={t("Csepegtető öntözés van", "Has drip irrigation")}
          v={d.constraints.drip}
          on={(v) => setC("drip", v)}
        />
        <Check
          label={t("Ágyásfedés (agrotextil + mulcs)", "Bed cover (fabric + mulch)")}
          v={d.constraints.mulchCover}
          on={(v) => setC("mulchCover", v)}
        />
      </fieldset>

      <label className="field">
        <span>{t("Megjegyzés", "Notes")}</span>
        <textarea
          rows={3}
          value={d.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          {t("Mégse", "Cancel")}
        </button>
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Check({
  label,
  v,
  on,
}: {
  label: string;
  v: boolean;
  on: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={v}
        onChange={(e) => on(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** "LA: 12, th 40" → { LA: 12, TH: 40 }; null when malformed. */
export function parseLimits(text: string): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const part of text
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const m = part.match(/^([a-zA-Z0-9]{2})\s*[:=]?\s*(\d+)$/);
    if (!m) return null;
    out[m[1].toUpperCase()] = +m[2];
  }
  return out;
}
