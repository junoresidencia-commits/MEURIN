import { calcKtv, calcUrr } from "../hd-calcs";
import { getTool } from "./catalog";
import type { CalcContext, CalcResult, ManualOverrides } from "./types";

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
function base(id: string) {
  const t = getTool(id)!;
  return {
    toolId: id, section: t.section, title: t.title, formula: t.formula, source: t.source,
    version: t.version, published: t.published, population: t.population, limitations: t.limitations,
  };
}
function miss(id: string, missing: string[]): CalcResult {
  return {
    ...base(id), status: "missing",
    headline: `Não foi possível calcular — falta ${missing.join(", ")}.`,
    explanation: "Sem inventar ureia ou tempo de sessão.",
    missing, values: [], staleWarnings: [], inputs: {}, outputs: {},
  };
}

export function calcUrrTool(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const pre = n(o.ureia_pre) ?? n(ctx.extra.ureia_pre);
  const post = n(o.ureia_pos) ?? n(ctx.extra.ureia_pos);
  const missing: string[] = [];
  if (pre == null) missing.push("ureia pré");
  if (post == null) missing.push("ureia pós");
  if (missing.length) return miss("urr", missing);
  const urr = calcUrr(pre, post);
  if (urr == null) {
    return { ...base("urr"), status: "not_applicable", headline: "Não aplicável — ureias inválidas (pós ≥ pré).", explanation: "Confira os valores da sessão.", missing: [], values: [], staleWarnings: [], inputs: { ureia_pre: pre, ureia_pos: post }, outputs: {} };
  }
  return {
    ...base("urr"), status: "ok",
    headline: `URR: ${String(urr).replace(".", ",")}%`,
    explanation: "Redução percentual de ureia na sessão.",
    missing: [],
    values: [
      { label: "Ureia pré", value: String(pre), unit: "mg/dL" },
      { label: "Ureia pós", value: String(post), unit: "mg/dL" },
      { label: "URR", value: String(urr).replace(".", ","), unit: "%" },
    ],
    staleWarnings: [],
    inputs: { ureia_pre: pre, ureia_pos: post },
    outputs: { urr },
  };
}

export function calcKtvTool(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const pre = n(o.ureia_pre) ?? n(ctx.extra.ureia_pre);
  const post = n(o.ureia_pos) ?? n(ctx.extra.ureia_pos);
  const hours = n(o.horas) ?? n(ctx.extra.horas);
  const uf = n(o.uf_kg) ?? n(ctx.extra.uf_kg);
  const wt = n(o.peso_kg) ?? ctx.weightKg;
  const missing: string[] = [];
  if (pre == null) missing.push("ureia pré");
  if (post == null) missing.push("ureia pós");
  if (hours == null) missing.push("tempo da sessão (horas)");
  if (missing.length) return miss("ktv_daugirdas", missing);
  const ktv = calcKtv(pre, post, hours, uf, wt);
  if (ktv == null) {
    return { ...base("ktv_daugirdas"), status: "not_applicable", headline: "Não aplicável — dados da sessão inválidos.", explanation: "Ureia pós deve ser menor que a pré; tempo > 0.", missing: [], values: [], staleWarnings: [], inputs: { ureia_pre: pre, ureia_pos: post, horas: hours }, outputs: {} };
  }
  return {
    ...base("ktv_daugirdas"), status: "ok",
    headline: `Kt/V: ${String(ktv).replace(".", ",")}`,
    explanation: uf != null && wt != null ? "Daugirdas com UF/peso." : "Daugirdas sem UF/peso (não inventados).",
    missing: uf == null || wt == null ? ["UF e peso (opcionais para a forma completa)"] : [],
    values: [
      { label: "Kt/V", value: String(ktv).replace(".", ",") },
      { label: "Ureia pré", value: String(pre) },
      { label: "Ureia pós", value: String(post) },
      { label: "Tempo", value: String(hours), unit: "h" },
    ],
    staleWarnings: [],
    inputs: { ureia_pre: pre, ureia_pos: post, horas: hours, uf_kg: uf, peso_kg: wt },
    outputs: { ktv },
  };
}
