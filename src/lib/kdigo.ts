/**
 * Classificação KDIGO (categoria G da TFGe e A da albuminúria).
 * Client-safe — usado na extração da evolução e no backfill.
 */

export const G_FROM_EGFR: { g: string; min: number; max: number }[] = [
  { g: "G1", min: 90, max: Infinity },
  { g: "G2", min: 60, max: 89.999 },
  { g: "G3a", min: 45, max: 59.999 },
  { g: "G3b", min: 30, max: 44.999 },
  { g: "G4", min: 15, max: 29.999 },
  { g: "G5", min: 0, max: 14.999 },
];

/** TFGe (mL/min/1,73m²) → categoria G. */
export function gFromEgfr(egfr: number): string | null {
  if (!Number.isFinite(egfr) || egfr < 0) return null;
  const hit = G_FROM_EGFR.find((r) => egfr >= r.min && egfr <= r.max);
  return hit?.g ?? null;
}

/** RAC/UACR em mg/g (ou albuminúria 24h em mg/24h) → A1 <30, A2 30–300, A3 >300.
 *  Não usar proteína total nem albumina urinária em mg/L. */
export function aFromRac(racMgG: number): "A1" | "A2" | "A3" | null {
  if (!Number.isFinite(racMgG) || racMgG < 0) return null;
  if (racMgG < 30) return "A1";
  if (racMgG <= 300) return "A2";
  return "A3";
}

/**
 * G3 (sem a/b) + TFGe → G3a/G3b. Outros G mencionados prevalecem se
 * compatíveis; se TFGe refina G3, usa a faixa.
 */
export function refineG(mentioned: string | null | undefined, egfr?: number | null): string | null {
  const fromLab = egfr != null ? gFromEgfr(egfr) : null;
  const g = mentioned?.toUpperCase().replace(/\s+/g, "") || null;
  if (g === "G3" && fromLab && (fromLab === "G3a" || fromLab === "G3b")) return fromLab;
  if (g && fromLab && g === fromLab) return g;
  if (g === "G3" && !fromLab) return "G3";
  if (fromLab && (!g || g === "G3")) return fromLab;
  if (g) return g;
  return fromLab;
}

/**
 * G1/G2 isolados não confirmam DRC. G3+ (TFGe <60) ou dano (A2/A3, fita)
 * ou menção explícita de DRC sustentam o diagnóstico.
 */
export function canConfirmDrc(opts: {
  mentionedDrc: boolean;
  g?: string | null;
  a?: string | null;
  proteinuriaFita?: string | null;
  chronicReducedEgfr: boolean;
}): boolean {
  if (opts.mentionedDrc) return true;
  if (opts.chronicReducedEgfr) return true;
  const g = opts.g || "";
  if (/^G3|^G4|^G5/.test(g)) return true;
  if (opts.a === "A2" || opts.a === "A3") return true;
  const fita = opts.proteinuriaFita || "";
  if (["1+", "2+", "3+", "4+"].includes(fita)) return true;
  return false;
}

export type LabPoint = { testKey: string; value: number; measuredAt: string };

export type PatientKdigoClass = {
  tfge: number | null;
  tfgeSource: "lab" | "calculado" | null;
  estagio_g: string | null;
  categoria_a: string | null;
  drc: "sim" | "nao" | null;
  kdigo: string | null;
  evidence: string[];
};

function latestLab(labs: LabPoint[], key: string): LabPoint | null {
  let hit: LabPoint | null = null;
  for (const l of labs) {
    if (l.testKey !== key || !Number.isFinite(l.value)) continue;
    if (!hit || l.measuredAt > hit.measuredAt) hit = l;
  }
  return hit;
}

/**
 * Classifica o paciente pelos exames (KDIGO G + A + DRC).
 * Não inventa albuminúria: só RAC (mg/g) ou albuminúria 24h (mg/24h).
 * TFGe vem do laboratório ou da CKD-EPI 2021 se houver creatinina + idade + sexo.
 */
export function classifyFromLabs(input: {
  labs: LabPoint[];
  birthdate?: string | null;
  sex?: string | null;
  ageYears?: number | null;
  ageReportedAt?: string | null;
  computeTfge?: (creatinine: number, measuredAt: string) => number | null;
}): PatientKdigoClass {
  const labs = input.labs || [];
  const evidence: string[] = [];
  const tfgeLab = latestLab(labs, "tfge") || latestLab(labs, "tfge_cistatina");
  let tfge = tfgeLab?.value ?? null;
  let tfgeSource: PatientKdigoClass["tfgeSource"] = tfgeLab ? "lab" : null;
  if (tfge == null) {
    const cr = latestLab(labs, "creatinina");
    if (cr && input.computeTfge) {
      const computed = input.computeTfge(cr.value, cr.measuredAt);
      if (computed != null) {
        tfge = computed;
        tfgeSource = "calculado";
        evidence.push(`TFGe ${computed} (CKD-EPI 2021 a partir da creatinina ${cr.value})`);
      }
    }
  } else {
    evidence.push(`TFGe ${tfge}`);
  }

  const rac = latestLab(labs, "rac");
  const aer = latestLab(labs, "albuminuria_24h");
  let categoria_a: string | null = null;
  if (rac) {
    categoria_a = aFromRac(rac.value);
    if (categoria_a) evidence.push(`RAC ${rac.value} → ${categoria_a}`);
  } else if (aer) {
    categoria_a = aFromRac(aer.value);
    if (categoria_a) evidence.push(`Albuminúria 24h ${aer.value} → ${categoria_a}`);
  }

  const estagio_g = tfge != null ? gFromEgfr(tfge) : null;
  if (estagio_g) evidence.push(`Estágio ${estagio_g}`);

  const series = labs
    .filter((l) => l.testKey === "tfge" || l.testKey === "tfge_cistatina")
    .map((l) => ({ value: l.value, at: l.measuredAt }));
  if (tfge != null && tfgeSource === "calculado") {
    const cr = latestLab(labs, "creatinina");
    series.push({ value: tfge, at: cr?.measuredAt || new Date().toISOString() });
  }
  const chronic = hasChronicReducedEgfr(series);
  if (chronic) evidence.push("TFGe <60 em ≥90 dias");

  let drc: "sim" | "nao" | null = null;
  if (canConfirmDrc({ mentionedDrc: false, g: estagio_g, a: categoria_a, chronicReducedEgfr: chronic })) {
    drc = "sim";
    evidence.push("DRC confirmada (KDIGO)");
  } else if (estagio_g === "G1" && categoria_a === "A1") {
    drc = "nao";
    evidence.push("G1 A1 — sem critério de DRC");
  }

  return {
    tfge,
    tfgeSource,
    estagio_g,
    categoria_a,
    drc,
    kdigo: estagio_g && categoria_a ? `${estagio_g}${categoria_a}` : null,
    evidence,
  };
}

/** Dois TFGe <60 com ≥90 dias de intervalo → cronicidade. */
export function hasChronicReducedEgfr(
  series: { value: number; at: string }[]
): boolean {
  const low = series
    .filter((s) => Number.isFinite(s.value) && s.value < 60)
    .map((s) => ({ ...s, t: new Date(s.at).getTime() }))
    .filter((s) => Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t);
  if (low.length < 2) return false;
  return low[low.length - 1].t - low[0].t >= 90 * 86400000;
}
