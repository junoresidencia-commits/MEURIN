import { calcUrr } from "./hd-calcs";
import type { HdAlert, HdAlertLevel, HdExamCode, HdRule } from "./hd-types";

export const DEFAULT_HD_RULES: Omit<HdRule, "id">[] = [
  {
    code: "ANEMIA-HB-CRIT",
    domain: "anemia",
    version: "1.0",
    source: "KDIGO",
    date: "2012-08-01",
    params: { hb: 8 },
    condition: "Hemoglobina < 8 g/dL",
    classification: "CRITICO",
    suggestion: "Anemia grave. Médico revisa e decide conduta de EPO/ferro. A IA não prescreve.",
    active: true,
  },
  {
    code: "ANEMIA-HB-REV",
    domain: "anemia",
    version: "1.0",
    source: "KDIGO",
    date: "2012-08-01",
    params: { hb: 10 },
    condition: "Hemoglobina < 10 g/dL",
    classification: "REVISAR",
    suggestion: "Hb abaixo da faixa usual de revisão. Conferir tendência e ferro antes de alterar EPO.",
    active: true,
  },
  {
    code: "FERRO-TSAT-REV",
    domain: "ferro",
    version: "1.0",
    source: "KDIGO",
    date: "2012-08-01",
    params: { tsat: 20 },
    condition: "TSAT < 20%",
    classification: "REVISAR",
    suggestion: "Saturação baixa. Avaliar reposição de ferro conforme protocolo interno.",
    active: true,
  },
  {
    code: "FERRO-FERRITIN-REV",
    domain: "ferro",
    version: "1.0",
    source: "KDIGO",
    date: "2012-08-01",
    params: { ferritin: 200 },
    condition: "Ferritina < 200 ng/mL",
    classification: "REVISAR",
    suggestion: "Ferritina baixa. Avaliar estoques de ferro antes de ajustar EPO.",
    active: true,
  },
  {
    code: "MBD-P-CRIT",
    domain: "DRC-MBD",
    version: "1.0",
    source: "KDIGO",
    date: "2017-01-01",
    params: { p: 7 },
    condition: "Fósforo > 7 mg/dL",
    classification: "CRITICO",
    suggestion: "Hiperfosfatemia grave. Revisar ligante, dieta e adequação dialítica.",
    active: true,
  },
  {
    code: "MBD-P-REV",
    domain: "DRC-MBD",
    version: "1.0",
    source: "KDIGO",
    date: "2017-01-01",
    params: { p: 5.5 },
    condition: "Fósforo > 5,5 mg/dL",
    classification: "REVISAR",
    suggestion: "Fósforo elevado. Conferir adesão ao sevelâmer e tendência.",
    active: true,
  },
  {
    code: "MBD-PTH-CRIT",
    domain: "DRC-MBD",
    version: "1.0",
    source: "KDIGO",
    date: "2017-01-01",
    params: { pth: 800 },
    condition: "PTH > 800 pg/mL",
    classification: "CRITICO",
    suggestion: "Hiperparatireoidismo acentuado. Médico decide calcitriol/cinacalcete/paricalcitol.",
    active: true,
  },
  {
    code: "MBD-PTH-REV",
    domain: "DRC-MBD",
    version: "1.0",
    source: "KDIGO",
    date: "2017-01-01",
    params: { pth: 600 },
    condition: "PTH > 600 pg/mL",
    classification: "REVISAR",
    suggestion: "PTH em elevação. Revisar tendência e protocolo de DRC-MBD.",
    active: true,
  },
  {
    code: "K-CRIT",
    domain: "potassio",
    version: "1.0",
    source: "SBN",
    date: "2021-01-01",
    params: { k: 6.5 },
    condition: "Potássio > 6,5 mEq/L",
    classification: "CRITICO",
    suggestion: "Hipercalemia grave. Prioridade clínica — médico decide.",
    active: true,
  },
  {
    code: "K-REV",
    domain: "potassio",
    version: "1.0",
    source: "SBN",
    date: "2021-01-01",
    params: { k: 5.5 },
    condition: "Potássio > 5,5 mEq/L",
    classification: "REVISAR",
    suggestion: "Potássio elevado. Conferir dieta, medicamentos e tempo de diálise.",
    active: true,
  },
  {
    code: "URR-REV",
    domain: "adequacao",
    version: "1.0",
    source: "KDIGO",
    date: "2015-01-01",
    params: { urr: 65 },
    condition: "URR < 65% (quando ureia pré e pós existem)",
    classification: "REVISAR",
    suggestion: "Adequação dialítica baixa. Revisar tempo, acesso e fluxo — sem inventar Kt/V.",
    active: true,
  },
  {
    code: "NUTRI-ALB-CRIT",
    domain: "nutricao",
    version: "1.0",
    source: "SBN",
    date: "2021-01-01",
    params: { albumin: 3 },
    condition: "Albumina < 3,0 g/dL",
    classification: "CRITICO",
    suggestion: "Hipoalbuminemia grave. Avaliar nutrição e inflamação.",
    active: true,
  },
  {
    code: "NUTRI-ALB-REV",
    domain: "nutricao",
    version: "1.0",
    source: "SBN",
    date: "2021-01-01",
    params: { albumin: 3.5 },
    condition: "Albumina < 3,5 g/dL",
    classification: "REVISAR",
    suggestion: "Albumina baixa. Acompanhar tendência nutricional.",
    active: true,
  },
];

export type LabMap = Partial<Record<HdExamCode, number | null>>;

function num(labs: LabMap, code: HdExamCode): number | null {
  const v = labs[code];
  return v == null || !Number.isFinite(v) ? null : v;
}

function hit(rule: HdRule, ok: boolean): HdAlert | null {
  if (!ok || !rule.active) return null;
  return {
    domain: rule.domain,
    level: rule.classification,
    code: rule.code,
    message: rule.condition,
    suggestion: rule.suggestion,
    source: rule.source,
  };
}

/** Motor determinístico. Não usa IA e não altera prescrição. */
export function evaluateHdLabs(labs: LabMap, rules: HdRule[]): HdAlert[] {
  const byCode = new Map(rules.filter((r) => r.active).map((r) => [r.code, r]));
  const out: HdAlert[] = [];
  const push = (code: string, cond: boolean) => {
    const rule = byCode.get(code);
    if (!rule) return;
    const a = hit(rule, cond);
    if (a) out.push(a);
  };

  const hb = num(labs, "hb");
  const tsat = num(labs, "tsat");
  const ferritin = num(labs, "ferritin");
  const p = num(labs, "p");
  const pth = num(labs, "pth");
  const k = num(labs, "k");
  const albumin = num(labs, "albumin");
  const urr = calcUrr(num(labs, "urea_pre"), num(labs, "urea_post"));

  if (hb != null) {
    push("ANEMIA-HB-CRIT", hb < (byCode.get("ANEMIA-HB-CRIT")?.params.hb ?? 8));
    if (hb >= (byCode.get("ANEMIA-HB-CRIT")?.params.hb ?? 8)) {
      push("ANEMIA-HB-REV", hb < (byCode.get("ANEMIA-HB-REV")?.params.hb ?? 10));
    }
  }
  if (tsat != null) push("FERRO-TSAT-REV", tsat < (byCode.get("FERRO-TSAT-REV")?.params.tsat ?? 20));
  if (ferritin != null) push("FERRO-FERRITIN-REV", ferritin < (byCode.get("FERRO-FERRITIN-REV")?.params.ferritin ?? 200));
  if (p != null) {
    push("MBD-P-CRIT", p > (byCode.get("MBD-P-CRIT")?.params.p ?? 7));
    if (p <= (byCode.get("MBD-P-CRIT")?.params.p ?? 7)) {
      push("MBD-P-REV", p > (byCode.get("MBD-P-REV")?.params.p ?? 5.5));
    }
  }
  if (pth != null) {
    push("MBD-PTH-CRIT", pth > (byCode.get("MBD-PTH-CRIT")?.params.pth ?? 800));
    if (pth <= (byCode.get("MBD-PTH-CRIT")?.params.pth ?? 800)) {
      push("MBD-PTH-REV", pth > (byCode.get("MBD-PTH-REV")?.params.pth ?? 600));
    }
  }
  if (k != null) {
    push("K-CRIT", k > (byCode.get("K-CRIT")?.params.k ?? 6.5));
    if (k <= (byCode.get("K-CRIT")?.params.k ?? 6.5)) {
      push("K-REV", k > (byCode.get("K-REV")?.params.k ?? 5.5));
    }
  }
  if (urr != null) push("URR-REV", urr < (byCode.get("URR-REV")?.params.urr ?? 65));
  if (albumin != null) {
    push("NUTRI-ALB-CRIT", albumin < (byCode.get("NUTRI-ALB-CRIT")?.params.albumin ?? 3));
    if (albumin >= (byCode.get("NUTRI-ALB-CRIT")?.params.albumin ?? 3)) {
      push("NUTRI-ALB-REV", albumin < (byCode.get("NUTRI-ALB-REV")?.params.albumin ?? 3.5));
    }
  }

  const rank: Record<HdAlertLevel, number> = { OK: 0, REVISAR: 1, CRITICO: 2 };
  return out.sort((a, b) => rank[b.level] - rank[a.level] || a.code.localeCompare(b.code));
}

export function worstLevel(alerts: HdAlert[]): HdAlertLevel {
  if (alerts.some((a) => a.level === "CRITICO")) return "CRITICO";
  if (alerts.some((a) => a.level === "REVISAR")) return "REVISAR";
  return "OK";
}
