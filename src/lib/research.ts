import "server-only";
import { listPatientsByDoctor, clinicalKey } from "./patients-store";
import { getProfilesByDoctor } from "./clinical-profile-store";
import { getLabResults } from "./patient-store";
import { computeImc } from "./clinical-fields";
import { RESEARCH_VARS_BY_KEY, type Operator } from "./research-fields";

export type CohortRecord = Record<string, string | number | null> & {
  __id: string;
  __name: string;
};

function ageFromBirthdate(birthdate?: string | null): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}
function normSex(sex?: string | null): string {
  const s = String(sex || "").toLowerCase();
  if (/^f|fem|mulher/.test(s)) return "feminino";
  if (/^m|masc|homem/.test(s)) return "masculino";
  return "desconhecido";
}

/** Monta um registro achatado por paciente com todas as variáveis de pesquisa. */
export async function buildCohortRecords(doctorId: string): Promise<CohortRecord[]> {
  const patients = await listPatientsByDoctor(doctorId);
  const profiles = await getProfilesByDoctor(doctorId);
  const profileByKey = new Map(profiles.map((p) => [p.patientKey, p.data]));

  const records: CohortRecord[] = [];
  for (const p of patients) {
    const key = clinicalKey(p);
    const data = profileByKey.get(key) || {};
    const rec: CohortRecord = { __id: p.id, __name: p.name };

    rec.idade = ageFromBirthdate(p.birthdate);
    rec.sexo = normSex(p.sex);
    rec.cidade = p.address || "";
    rec.imc = computeImc(data);

    // Campos do perfil clínico (tri ausente = "desconhecido")
    for (const [, v] of RESEARCH_VARS_BY_KEY) {
      if (v.key.startsWith("lab_") || ["idade", "sexo", "cidade", "imc"].includes(v.key)) continue;
      const raw = data[v.key];
      if (v.type === "num") rec[v.key] = raw === undefined || raw === "" ? null : Number(String(raw).replace(",", "."));
      else rec[v.key] = raw === undefined || raw === null || raw === "" ? "desconhecido" : String(raw);
    }

    // Últimos valores laboratoriais
    const labs = await getLabResults(key);
    const latest = new Map<string, number>();
    for (const l of labs) latest.set(l.testKey, l.value); // labs vêm ordenados por data asc → último vence
    for (const [testKey, value] of latest) rec[`lab_${testKey}`] = value;

    records.push(rec);
  }
  return records;
}

export interface Filter {
  field: string;
  op: Operator;
  value: string;
  value2?: string;
}

function matches(rec: CohortRecord, f: Filter): boolean {
  const def = RESEARCH_VARS_BY_KEY.get(f.field);
  if (!def) return true;
  const raw = rec[f.field];

  if (def.type === "num") {
    if (raw === null || raw === undefined) return false; // ausente nunca casa em numérico
    const n = Number(raw);
    const a = Number(String(f.value).replace(",", "."));
    const b = Number(String(f.value2 ?? "").replace(",", "."));
    switch (f.op) {
      case "=": return n === a;
      case "!=": return n !== a;
      case ">": return n > a;
      case "<": return n < a;
      case "entre": return Number.isFinite(a) && Number.isFinite(b) && n >= a && n <= b;
      default: return true;
    }
  }
  const val = String(raw ?? "").toLowerCase();
  if (def.type === "text") {
    const target = f.value.toLowerCase().trim();
    if (f.op === "!=") return !val.includes(target);
    return val.includes(target); // "=" => contém
  }
  // cat
  const target = f.value.toLowerCase();
  if (f.op === "!=") return val !== target;
  return val === target;
}

export function applyFilters(records: CohortRecord[], filters: Filter[]): CohortRecord[] {
  return records.filter((r) => filters.every((f) => matches(r, f)));
}

function numStats(vals: number[]) {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const mean = s.reduce((x, y) => x + y, 0) / s.length;
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return {
    n: s.length,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: s[0],
    max: s[s.length - 1],
  };
}
function dist(records: CohortRecord[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) {
    const v = String(r[key] ?? "desconhecido");
    out[v] = (out[v] || 0) + 1;
  }
  return out;
}

export function describe(records: CohortRecord[]) {
  const idade = numStats(records.map((r) => Number(r.idade)).filter((n) => Number.isFinite(n)));
  const tfge = numStats(records.map((r) => Number(r.lab_tfge)).filter((n) => Number.isFinite(n)));
  const creat = numStats(records.map((r) => Number(r.lab_creatinina)).filter((n) => Number.isFinite(n)));
  const rac = numStats(records.map((r) => Number(r.lab_rac)).filter((n) => Number.isFinite(n)));
  return {
    n: records.length,
    idade,
    tfge,
    creatinina: creat,
    rac,
    sexo: dist(records, "sexo"),
    drc: dist(records, "drc"),
    estagio_g: dist(records, "estagio_g"),
    categoria_a: dist(records, "categoria_a"),
    etiologia_principal: dist(records, "etiologia_principal"),
    has: dist(records, "has"),
    dm: dist(records, "dm"),
  };
}
