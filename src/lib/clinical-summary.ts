import { etiologiaLabel } from "./clinical-fields";

const YES = (v: unknown) => String(v ?? "").toLowerCase() === "sim";

export type SummaryLab = { testKey: string; value: number; unit?: string | null };

function lab(labs: SummaryLab[], key: string): string | null {
  const hit = labs.find((l) => l.testKey === key);
  if (!hit) return null;
  const n = String(hit.value).replace(".", ",");
  const u = hit.unit ? ` ${hit.unit}` : "";
  return `${n}${u}`;
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

  if (data.medicamentos_em_uso) lines.push(`Em uso: ${String(data.medicamentos_em_uso)}`);
  if (YES(data.alergias_negadas) && !data.alergias) lines.push("Sem alergias medicamentosas conhecidas");
  else if (data.alergias) lines.push(`Alergias: ${String(data.alergias)}`);

  return lines;
}
