import { etiologiaLabel } from "./clinical-fields";

const YES = (v: unknown) => String(v ?? "").toLowerCase() === "sim";

export type SummaryLab = { testKey: string; value: number; unit?: string | null; measuredAt?: string | null };

function labDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function lab(labs: SummaryLab[], key: string): string | null {
  const hits = labs.filter((l) => l.testKey === key);
  const hit = hits
    .slice()
    .sort((a, b) => String(b.measuredAt || "").localeCompare(String(a.measuredAt || "")))[0];
  if (!hit) return null;
  const n = String(hit.value).replace(".", ",");
  const u = hit.unit ? ` ${hit.unit}` : "";
  const dt = labDate(hit.measuredAt);
  return `${n}${u}${dt ? ` (${dt})` : ""}`;
}

export function formatMedicationLines(raw?: unknown): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/\n|;/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function dxList(data: Record<string, unknown>): string[] {
  const rows: [string, string][] = [
    ["has", "HAS"],
    ["dm", "DM"],
    ["dpoc", "DPOC"],
    ["asma", "Asma"],
    ["ic", "IC"],
    ["fa", "FA"],
    ["dcv", "DCV"],
    ["obesidade", "Obesidade"],
    ["dislipidemia", "Dislipidemia"],
    ["ckm", "CKM"],
  ];
  return rows.filter(([k]) => YES(data[k])).map(([, l]) => l);
}

/** Resumo clínico automático a partir do perfil + últimos exames. */
export function buildClinicalSummary(opts: {
  age?: number | null;
  data: Record<string, unknown>;
  labs: SummaryLab[];
}): string[] {
  const { data, labs, age } = opts;
  const lines: string[] = [];
  const head: string[] = [];
  if (age != null) head.push(`${age} anos`);
  if (data.profissao) head.push(String(data.profissao));
  if (head.length) lines.push(head.join(" · "));

  const dx = dxList(data);
  if (dx.length) lines.push(dx.join(" · "));

  const renal: string[] = [];
  if (YES(data.drc) || data.estagio_g || data.categoria_a) {
    renal.push(["DRC", data.estagio_g, data.categoria_a].filter(Boolean).join(" "));
  }
  const et = etiologiaLabel(String(data.etiologia_principal || ""));
  if (et) renal.push(et);
  const tfge = lab(labs, "tfge");
  if (tfge) renal.push(`TFGe ${tfge}`);
  const cr = lab(labs, "creatinina");
  if (cr) renal.push(`Cr ${cr}`);
  const rac = lab(labs, "rac");
  if (rac) renal.push(`RAC ${rac}`);
  const pu24 = lab(labs, "proteinuria_24h");
  if (pu24) renal.push(`Proteinúria 24h ${pu24}`);
  const au24 = lab(labs, "albuminuria_24h");
  if (au24) renal.push(`Albuminúria 24h ${au24}`);
  const ua = lab(labs, "microalbuminuria");
  if (ua) renal.push(`Albumina urinária ${ua}`);
  const k = lab(labs, "potassio");
  if (k) renal.push(`K ${k}`);
  const hb = lab(labs, "hemoglobina");
  if (hb) renal.push(`Hb ${hb}`);
  if (data.proteinuria_fita && data.proteinuria_fita !== "negativo") {
    renal.push(`Proteinúria fita ${String(data.proteinuria_fita)}`);
  }
  if (renal.length) lines.push(renal.join(" · "));

  const habits: string[] = [];
  if (YES(data.ex_tabagista)) habits.push("Ex-tabagista");
  else if (YES(data.tabagismo)) habits.push("Tabagista");
  if (data.carga_tabagica) habits.push(`${data.carga_tabagica} anos-maço`);
  if (habits.length) lines.push(habits.join(" · "));

  const meds = formatMedicationLines(data.medicamentos_em_uso);
  if (meds.length === 1) lines.push(`Em uso: ${meds[0]}`);
  else if (meds.length > 1) lines.push(`Em uso: ${meds.join(" · ")}`);
  if (YES(data.alergias_negadas) && !data.alergias) lines.push("Sem alergias medicamentosas conhecidas");
  else if (data.alergias) lines.push(`Alergias: ${String(data.alergias)}`);

  return lines;
}
