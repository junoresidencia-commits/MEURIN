import { getTool } from "./catalog";
import type { CalcContext, CalcResult, ManualOverrides } from "./types";

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
function lab(ctx: CalcContext, key: string) {
  return ctx.labs[key] || null;
}
function base(id: string) {
  const t = getTool(id)!;
  return {
    toolId: id,
    section: t.section,
    title: t.title,
    formula: t.formula,
    source: t.source,
    version: t.version,
    published: t.published,
    population: t.population,
    limitations: t.limitations,
    officialUrl: t.officialUrl,
  };
}
function miss(id: string, missing: string[]): CalcResult {
  return {
    ...base(id),
    status: "missing",
    headline: `Não foi possível calcular — falta ${missing.join(", ")}.`,
    explanation: "Valores em branco não foram preenchidos automaticamente.",
    missing,
    values: [],
    staleWarnings: [],
    inputs: {},
    outputs: {},
  };
}

export function calcAnionGap(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const na = n(o.sodio) ?? lab(ctx, "sodio")?.value ?? null;
  const cl = n(o.cloro) ?? lab(ctx, "cloro")?.value ?? null;
  const hco3 = n(o.bicarbonato) ?? lab(ctx, "bicarbonato")?.value ?? null;
  const alb = n(o.albumina) ?? lab(ctx, "albumina")?.value ?? null;
  const missing: string[] = [];
  if (na == null) missing.push("sódio");
  if (cl == null) missing.push("cloro");
  if (hco3 == null) missing.push("bicarbonato");
  if (missing.length) return miss("anion_gap", missing);
  const ag = Math.round((na - (cl + hco3)) * 10) / 10;
  const agc = alb != null ? Math.round((ag + 2.5 * (4 - alb)) * 10) / 10 : null;
  return {
    ...base("anion_gap"),
    status: "ok",
    headline: `Ânion gap: ${String(ag).replace(".", ",")} mEq/L${agc != null ? ` · corrigido: ${String(agc).replace(".", ",")}` : ""}`,
    explanation: alb == null ? "Sem albumina: gap não corrigido." : "Gap corrigido pela albumina (fator 2,5; albumina de referência 4 g/dL).",
    missing: alb == null ? ["albumina (para correção)"] : [],
    values: [
      { label: "Na", value: String(na), unit: "mEq/L" },
      { label: "Cl", value: String(cl), unit: "mEq/L" },
      { label: "HCO3", value: String(hco3), unit: "mEq/L" },
      { label: "AG", value: String(ag).replace(".", ","), unit: "mEq/L" },
      { label: "AG corrigido", value: agc != null ? String(agc).replace(".", ",") : "—", unit: "mEq/L" },
      { label: "Albumina", value: alb != null ? String(alb) : "—", unit: "g/dL" },
    ],
    staleWarnings: [],
    inputs: { sodio: na, cloro: cl, bicarbonato: hco3, albumina: alb },
    outputs: { anion_gap: ag, anion_gap_corrigido: agc },
  };
}

export function calcDeltaGap(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const agRes = calcAnionGap(ctx, o);
  const ag = agRes.status === "ok" ? Number(agRes.outputs.anion_gap) : null;
  const hco3 = n(o.bicarbonato) ?? lab(ctx, "bicarbonato")?.value ?? null;
  if (ag == null || hco3 == null) return miss("delta_gap", ag == null ? ["ânion gap"] : ["bicarbonato"]);
  if (ag <= 12) {
    return {
      ...base("delta_gap"),
      status: "not_applicable",
      headline: "Não aplicável — ânion gap não está elevado.",
      explanation: "Delta gap/delta ratio é interpretado quando o AG está alto.",
      missing: [],
      values: [{ label: "AG", value: String(ag) }],
      staleWarnings: [],
      inputs: { anion_gap: ag, bicarbonato: hco3 },
      outputs: {},
    };
  }
  const dAg = ag - 12;
  const dHco = 24 - hco3;
  const ratio = dHco !== 0 ? Math.round((dAg / dHco) * 100) / 100 : null;
  return {
    ...base("delta_gap"),
    status: "ok",
    headline: `ΔAG ${String(dAg).replace(".", ",")} · ΔHCO3 ${String(dHco).replace(".", ",")} · razão ${ratio ?? "—"}`,
    explanation: "Referências usadas: AG 12 e HCO3 24. Interpretação clínica permanece com o médico.",
    missing: [],
    values: [
      { label: "ΔAG", value: String(dAg).replace(".", ",") },
      { label: "ΔHCO3", value: String(dHco).replace(".", ",") },
      { label: "Delta ratio", value: ratio != null ? String(ratio).replace(".", ",") : "—" },
    ],
    staleWarnings: [],
    inputs: { anion_gap: ag, bicarbonato: hco3 },
    outputs: { delta_ag: dAg, delta_hco3: dHco, delta_ratio: ratio },
  };
}

export function calcNaGlucose(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const na = n(o.sodio) ?? lab(ctx, "sodio")?.value ?? null;
  const glu = n(o.glicemia) ?? lab(ctx, "glicemia")?.value ?? lab(ctx, "glicemia_jejum")?.value ?? null;
  const missing: string[] = [];
  if (na == null) missing.push("sódio");
  if (glu == null) missing.push("glicose");
  if (missing.length) return miss("na_corrected_glucose", missing);
  if (glu <= 100) {
    return {
      ...base("na_corrected_glucose"),
      status: "not_applicable",
      headline: "Não aplicável — glicose ≤ 100 mg/dL (sem correção).",
      explanation: "A correção é para hiperglicemia.",
      missing: [],
      values: [{ label: "Na", value: String(na) }, { label: "Glicose", value: String(glu) }],
      staleWarnings: [],
      inputs: { sodio: na, glicemia: glu },
      outputs: {},
    };
  }
  const corr = Math.round((na + 1.6 * ((glu - 100) / 100)) * 10) / 10;
  return {
    ...base("na_corrected_glucose"),
    status: "ok",
    headline: `Na corrigido: ${String(corr).replace(".", ",")} mEq/L`,
    explanation: `Na medido ${na} com glicose ${glu} mg/dL (fator 1,6).`,
    missing: [],
    values: [
      { label: "Na medido", value: String(na), unit: "mEq/L" },
      { label: "Glicose", value: String(glu), unit: "mg/dL" },
      { label: "Na corrigido", value: String(corr).replace(".", ","), unit: "mEq/L" },
    ],
    staleWarnings: [],
    inputs: { sodio: na, glicemia: glu },
    outputs: { na_corrigido: corr },
  };
}

export function calcOsm(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const na = n(o.sodio) ?? lab(ctx, "sodio")?.value ?? null;
  const glu = n(o.glicemia) ?? lab(ctx, "glicemia")?.value ?? lab(ctx, "glicemia_jejum")?.value ?? null;
  const urea = n(o.ureia) ?? lab(ctx, "ureia")?.value ?? null;
  const measured = n(o.osm_medida) ?? n(ctx.extra.osm_medida) ?? null;
  const missing: string[] = [];
  if (na == null) missing.push("sódio");
  if (glu == null) missing.push("glicose");
  if (urea == null) missing.push("ureia");
  if (missing.length) return miss("osm_calculated", missing);
  const calc = Math.round((2 * na + glu / 18 + urea / 6) * 10) / 10;
  const gap = measured != null ? Math.round((measured - calc) * 10) / 10 : null;
  return {
    ...base("osm_calculated"),
    status: "ok",
    headline: gap != null ? `Osm calc. ${String(calc).replace(".", ",")} · gap ${String(gap).replace(".", ",")}` : `Osmolaridade calculada: ${String(calc).replace(".", ",")} mOsm/kg`,
    explanation: measured == null ? "Gap osmolar não calculado — falta osmolaridade medida." : "Gap = osm medida − calculada.",
    missing: measured == null ? ["osmolaridade medida (para o gap)"] : [],
    values: [
      { label: "Na", value: String(na) },
      { label: "Glicose", value: String(glu), unit: "mg/dL" },
      { label: "Ureia", value: String(urea), unit: "mg/dL" },
      { label: "Osm calculada", value: String(calc).replace(".", ","), unit: "mOsm/kg" },
      { label: "Osm medida", value: measured != null ? String(measured) : "—" },
      { label: "Gap", value: gap != null ? String(gap).replace(".", ",") : "—" },
    ],
    staleWarnings: [],
    inputs: { sodio: na, glicemia: glu, ureia: urea, osm_medida: measured },
    outputs: { osm_calculada: calc, osm_gap: gap },
  };
}

export function calcCaCorr(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const ca = n(o.calcio) ?? lab(ctx, "calcio")?.value ?? null;
  const alb = n(o.albumina) ?? lab(ctx, "albumina")?.value ?? null;
  const missing: string[] = [];
  if (ca == null) missing.push("cálcio");
  if (alb == null) missing.push("albumina");
  if (missing.length) return miss("ca_corrected", missing);
  const corr = Math.round((ca + 0.8 * (4 - alb)) * 100) / 100;
  return {
    ...base("ca_corrected"),
    status: "ok",
    headline: `Cálcio corrigido: ${String(corr).replace(".", ",")} mg/dL`,
    explanation: `Ca ${ca} + 0,8 × (4 − ${alb}). Não substitui cálcio iônico.`,
    missing: [],
    values: [
      { label: "Ca total", value: String(ca), unit: "mg/dL" },
      { label: "Albumina", value: String(alb), unit: "g/dL" },
      { label: "Ca corrigido", value: String(corr).replace(".", ","), unit: "mg/dL" },
    ],
    staleWarnings: [],
    inputs: { calcio: ca, albumina: alb },
    outputs: { ca_corrigido: corr },
  };
}

export function calcFena(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const uNa = n(o.una) ?? n(ctx.extra.una);
  const pNa = n(o.sodio) ?? lab(ctx, "sodio")?.value ?? null;
  const uCr = n(o.ucr) ?? n(ctx.extra.ucr);
  const pCr = n(o.creatinina) ?? lab(ctx, "creatinina")?.value ?? null;
  const missing: string[] = [];
  if (uNa == null) missing.push("Na urinário");
  if (pNa == null) missing.push("Na plasmático");
  if (uCr == null) missing.push("Cr urinária");
  if (pCr == null) missing.push("Cr plasmática");
  if (uNa == null || pNa == null || uCr == null || pCr == null) return miss("fena", missing);
  if (pNa === 0 || uCr === 0) return miss("fena", ["valores > 0"]);
  const fena = Math.round(((uNa * pCr) / (pNa * uCr)) * 10000) / 100;
  return {
    ...base("fena"),
    status: "ok",
    headline: `FENa: ${String(fena).replace(".", ",")}%`,
    explanation: "Diuréticos invalidam a interpretação clássica. O médico decide.",
    missing: [],
    values: [
      { label: "UNa", value: String(uNa) },
      { label: "PNa", value: String(pNa) },
      { label: "UCr", value: String(uCr) },
      { label: "PCr", value: String(pCr) },
      { label: "FENa", value: String(fena).replace(".", ","), unit: "%" },
    ],
    staleWarnings: [],
    inputs: { una: uNa, sodio: pNa, ucr: uCr, creatinina: pCr },
    outputs: { fena },
  };
}

export function calcFeureia(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const uU = n(o.uureia) ?? n(ctx.extra.uureia);
  const pU = n(o.ureia) ?? lab(ctx, "ureia")?.value ?? null;
  const uCr = n(o.ucr) ?? n(ctx.extra.ucr);
  const pCr = n(o.creatinina) ?? lab(ctx, "creatinina")?.value ?? null;
  const missing: string[] = [];
  if (uU == null) missing.push("ureia urinária");
  if (pU == null) missing.push("ureia plasmática");
  if (uCr == null) missing.push("Cr urinária");
  if (pCr == null) missing.push("Cr plasmática");
  if (uU == null || pU == null || uCr == null || pCr == null) return miss("feureia", missing);
  if (pU === 0 || uCr === 0) return miss("feureia", ["valores > 0"]);
  const fe = Math.round(((uU * pCr) / (pU * uCr)) * 10000) / 100;
  return {
    ...base("feureia"),
    status: "ok",
    headline: `FEUreia: ${String(fe).replace(".", ",")}%`,
    explanation: "Útil quando há diurético; interpretação clínica.",
    missing: [],
    values: [
      { label: "U ureia", value: String(uU) },
      { label: "P ureia", value: String(pU) },
      { label: "UCr", value: String(uCr) },
      { label: "PCr", value: String(pCr) },
      { label: "FEUreia", value: String(fe).replace(".", ","), unit: "%" },
    ],
    staleWarnings: [],
    inputs: { uureia: uU, ureia: pU, ucr: uCr, creatinina: pCr },
    outputs: { feureia: fe },
  };
}
