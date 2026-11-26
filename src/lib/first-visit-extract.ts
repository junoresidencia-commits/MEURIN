import { extractClinicalFields } from "./clinical-intelligence";
import { etiologiaLabel } from "./clinical-fields";
import { aFromRac, canConfirmDrc, gFromEgfr } from "./kdigo";
import { estimateEgfr } from "./egfr";
import { resolvePatientAge } from "./patient-age";
import {
  arrivedWithoutExams,
  advancedKidneyDisease,
  CARE_REASON_LABEL,
  classifyArrivalExams,
  FIRST_VISIT_EXAMS,
  incompleteWorkup,
  municipioFromAddress,
  parseBloodPressure,
  pct,
  splitLabsAtVisit,
  textHasUsg,
  type BookingLite,
  type ExamAtArrival,
  type FirstVisitAnchor,
  type LabPoint,
  type NoteLite,
  type VisitCertainty,
} from "./first-visit";

const COMORBIDITY_KEYS = ["has", "dm", "ic", "dcv", "obesidade", "dislipidemia", "dpoc", "asma", "fa", "doenca_autoimune"] as const;
const COMORBIDITY_LABEL: Record<string, string> = {
  has: "HAS",
  dm: "DM",
  ic: "IC",
  dcv: "DCV",
  obesidade: "Obesidade",
  dislipidemia: "Dislipidemia",
  dpoc: "DPOC",
  asma: "Asma",
  fa: "FA",
  doenca_autoimune: "Doença autoimune",
};

export type DocLite = { title?: string | null; body?: string | null; type?: string | null; createdAt: string };
export type UploadLite = { name?: string | null; category?: string | null; examDate?: string | null; createdAt: string };
export type VitalLite = { kind?: string; systolic?: number | null; diastolic?: number | null; measuredAt: string };

export type FirstVisitRecord = {
  patientId: string;
  patientKey: string;
  identityKey: string;
  name: string;
  visitAt: string;
  visitDate: string;
  source: FirstVisitAnchor["source"];
  certainty: FirstVisitAnchor["certainty"];
  certaintyReason: string;
  careReason: string | null;
  motivo: string;
  municipio: string;
  idade: number | null;
  sexo: string;
  pa: string | null;
  medicamentos: string;
  comorbidades: string;
  diagnostico: string;
  drc: "sim" | "nao" | "desconhecido";
  estagio_g: string;
  categoria_a: string;
  tfge: number | null;
  creatinina: number | null;
  exames: ExamAtArrival[];
  semExames: boolean;
  investigacaoIncompleta: boolean;
  doencaAvancada: boolean;
  clinica: string | null;
};

function noteBlob(n: NoteLite | null): string {
  if (!n) return "";
  return [n.chiefComplaint, n.history, n.assessment, n.plan].filter(Boolean).join("\n");
}

function noteAtVisit(notes: NoteLite[], visitAt: string, doctorId: string, noteId?: string | null): NoteLite | null {
  if (noteId) {
    const pinned = notes.find((n) => n.id === noteId);
    if (pinned) return pinned;
  }
  const t = new Date(visitAt).getTime();
  const mine = notes.filter((n) => n.doctorId === doctorId);
  const window = mine.filter((n) => {
    const nt = new Date(n.createdAt).getTime();
    return Number.isFinite(nt) && nt <= t + 36 * 3600_000;
  });
  if (window.length) return window.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return null;
}

function normSex(sex?: string | null): string {
  const s = String(sex || "").toLowerCase();
  if (/^f|fem|mulher/.test(s)) return "feminino";
  if (/^m|masc|homem/.test(s)) return "masculino";
  return "desconhecido";
}

function usgFromArtifacts(docs: DocLite[], uploads: UploadLite[], visitAt: string): { brought?: { at: string | null; label?: string | null }; after: boolean } {
  const t = new Date(visitAt).getTime();
  const items: { at: string; label: string }[] = [];
  for (const d of docs) {
    const text = `${d.title || ""} ${d.body || ""}`;
    if (!textHasUsg(text) && !/ultrasson|usg/i.test(d.title || "")) continue;
    items.push({ at: d.createdAt, label: d.title || "USG" });
  }
  for (const u of uploads) {
    const text = `${u.name || ""} ${u.category || ""}`;
    if (!textHasUsg(text) && !/ultrasson|usg|rim/i.test(text)) continue;
    items.push({ at: u.examDate || u.createdAt, label: u.name || "USG" });
  }
  const brought = items.filter((i) => new Date(i.at).getTime() <= t + 12 * 3600_000);
  const after = items.some((i) => new Date(i.at).getTime() > t + 12 * 3600_000);
  return {
    brought: brought.length ? { at: brought[0].at, label: brought[0].label } : undefined,
    after,
  };
}

export function extractFirstVisitRecord(input: {
  patientId: string;
  patientKey: string;
  identityKey: string;
  name: string;
  birthdate?: string | null;
  ageYears?: number | null;
  ageReportedAt?: string | null;
  sex?: string | null;
  address?: string | null;
  diseases?: string | null;
  medications?: string | null;
  anchor: FirstVisitAnchor;
  notes: NoteLite[];
  labs: LabPoint[];
  docs?: DocLite[];
  uploads?: UploadLite[];
  vitals?: VitalLite[];
  doctorId: string;
}): FirstVisitRecord {
  const visitAt = input.anchor.visitAt;
  const note = noteAtVisit(input.notes, visitAt, input.doctorId, input.anchor.noteId);
  const blob = [noteBlob(note), input.diseases].filter(Boolean).join("\n");
  const { brought, after } = splitLabsAtVisit(input.labs, visitAt);
  const detected = extractClinicalFields(
    blob,
    brought.map((l) => ({ testKey: l.testKey, value: l.value, measuredAt: l.measuredAt }))
  );
  const det = Object.fromEntries(detected.map((d) => [d.key, d]));

  const tfgeLab = [...brought].reverse().find((l) => l.testKey === "tfge" || l.testKey === "tfge_cistatina");
  const crLab = [...brought].reverse().find((l) => l.testKey === "creatinina");
  let tfge = tfgeLab?.value ?? null;
  if (tfge == null && crLab) {
    tfge = estimateEgfr(crLab.value, input.birthdate, input.sex, crLab.measuredAt, {
      ageYears: input.ageYears,
      ageReportedAt: input.ageReportedAt,
    });
  }
  const racLab = [...brought].reverse().find((l) => l.testKey === "rac");
  const aerLab = [...brought].reverse().find((l) => l.testKey === "albuminuria_24h");
  const estagio_g = (det.estagio_g?.value as string) || (tfge != null ? gFromEgfr(tfge) : null) || "";
  const categoria_a =
    (det.categoria_a?.value as string) ||
    (racLab ? aFromRac(racLab.value) : aerLab ? aFromRac(aerLab.value) : null) ||
    "";
  const mentionedDrc = det.drc?.value === "sim" || /\bdrc\b/i.test(blob);
  let drc: "sim" | "nao" | "desconhecido" = "desconhecido";
  if (canConfirmDrc({ mentionedDrc, g: estagio_g, a: categoria_a, proteinuriaFita: det.proteinuria_fita?.value, chronicReducedEgfr: false })) {
    drc = "sim";
  } else if (estagio_g === "G1" && categoria_a === "A1") {
    drc = "nao";
  }

  const usg = usgFromArtifacts(input.docs || [], input.uploads || [], visitAt);
  const exams = classifyArrivalExams({
    labsBrought: brought,
    labsAfter: after,
    noteText: blob,
    easFromNote: { proteinuria: det.proteinuria_fita?.value, hematuria: det.hematuria_fita?.value },
    usgBrought: usg.brought,
    usgAfter: usg.after,
    sex: input.sex,
  });

  const comorb = COMORBIDITY_KEYS.filter((k) => det[k]?.value === "sim").map((k) => COMORBIDITY_LABEL[k]);
  const et = etiologiaLabel(det.etiologia_principal?.value);
  const dxParts = [
    drc === "sim" ? ["DRC", estagio_g, categoria_a].filter(Boolean).join(" ") : "",
    et,
    note?.assessment?.trim() || "",
  ].filter(Boolean);

  const meds = [det.medicamentos_em_uso?.value, input.medications].filter(Boolean).join("; ").trim();

  let pa: string | null = null;
  const vitals = (input.vitals || [])
    .filter((v) => v.kind === "bp" && v.systolic && v.diastolic && v.measuredAt <= new Date(new Date(visitAt).getTime() + 12 * 3600_000).toISOString())
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  if (vitals[0]) pa = `${vitals[0].systolic}/${vitals[0].diastolic}`;
  else {
    const parsed = parseBloodPressure(blob);
    if (parsed) pa = `${parsed.systolic}/${parsed.diastolic}`;
  }

  const motivo = [note?.chiefComplaint, input.anchor.careReason ? CARE_REASON_LABEL[input.anchor.careReason] || input.anchor.careReason : ""]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" — ");

  return {
    patientId: input.patientId,
    patientKey: input.patientKey,
    identityKey: input.identityKey,
    name: input.name,
    visitAt,
    visitDate: String(visitAt).slice(0, 10),
    source: input.anchor.source,
    certainty: input.anchor.certainty,
    certaintyReason: input.anchor.certaintyReason,
    careReason: input.anchor.careReason,
    motivo: motivo || "desconhecido",
    municipio: municipioFromAddress(input.address, input.anchor.patientCity),
    idade: resolvePatientAge(
      { birthdate: input.birthdate, ageYears: input.ageYears, ageReportedAt: input.ageReportedAt },
      visitAt
    ),
    sexo: normSex(input.sex),
    pa,
    medicamentos: meds || "desconhecido",
    comorbidades: comorb.length ? comorb.join(", ") : "desconhecido",
    diagnostico: dxParts.join(" · ") || "desconhecido",
    drc,
    estagio_g: estagio_g || "desconhecido",
    categoria_a: categoria_a || "desconhecido",
    tfge,
    creatinina: crLab?.value ?? null,
    exames: exams,
    semExames: arrivedWithoutExams(exams),
    investigacaoIncompleta: incompleteWorkup(exams),
    doencaAvancada: advancedKidneyDisease({ tfge, estagioG: estagio_g }),
    clinica: input.anchor.locationName,
  };
}

export function bookingsForPatient(all: BookingLite[], email: string, extraKeys: string[]): BookingLite[] {
  const keys = new Set([email, ...extraKeys].map((k) => k.toLowerCase().trim()).filter(Boolean));
  return all.filter((b) => keys.has(String(b.patientEmail || "").toLowerCase().trim()));
}

export type FirstVisitFilters = {
  from?: string | null;
  to?: string | null;
  municipio?: string | null;
  idadeMin?: number | null;
  idadeMax?: number | null;
  diagnostico?: string | null;
  certeza?: VisitCertainty | "" | null;
  drc?: string | null;
};

export type FirstVisitStats = {
  n: number;
  total: number;
  semExames: number;
  semExamesPct: number;
  investigacaoIncompleta: number;
  investigacaoIncompletaPct: number;
  doencaAvancada: number;
  doencaAvancadaPct: number;
  incerteza: number;
  incertezaPct: number;
  exames: { key: string; label: string; n: number; pct: number }[];
  municipios: Record<string, number>;
  certeza: Record<string, number>;
  drc: Record<string, number>;
  sexo: Record<string, number>;
};

function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function dist(rows: FirstVisitRecord[], key: keyof FirstVisitRecord): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = String(r[key] ?? "desconhecido") || "desconhecido";
    out[v] = (out[v] || 0) + 1;
  }
  return out;
}

export function matchesFirstVisitFilters(r: FirstVisitRecord, f: FirstVisitFilters): boolean {
  if (f.from && r.visitDate < f.from) return false;
  if (f.to && r.visitDate > f.to) return false;
  if (f.municipio && !fold(r.municipio).includes(fold(f.municipio))) return false;
  if (f.idadeMin != null && !(r.idade != null && r.idade >= f.idadeMin)) return false;
  if (f.idadeMax != null && !(r.idade != null && r.idade <= f.idadeMax)) return false;
  if (f.certeza && r.certainty !== f.certeza) return false;
  if (f.drc && r.drc !== f.drc) return false;
  if (f.diagnostico) {
    const q = fold(f.diagnostico);
    if (!fold(r.diagnostico).includes(q) && !fold(r.estagio_g).includes(q) && fold(r.drc) !== q) return false;
  }
  return true;
}

export function firstVisitStats(matched: FirstVisitRecord[], total: number): FirstVisitStats {
  const n = matched.length;
  const sem = matched.filter((r) => r.semExames).length;
  const inc = matched.filter((r) => r.investigacaoIncompleta).length;
  const adv = matched.filter((r) => r.doencaAvancada).length;
  const unc = matched.filter((r) => r.certainty === "incerta").length;
  const exames = FIRST_VISIT_EXAMS.map((e) => {
    const k = matched.filter((r) => r.exames.find((x) => x.key === e.key)?.status === "disponivel").length;
    return { key: e.key, label: e.label, n: k, pct: pct(k, n) };
  });
  const municipios: Record<string, number> = {};
  for (const r of matched) {
    const m = r.municipio || "desconhecido";
    municipios[m] = (municipios[m] || 0) + 1;
  }
  return {
    n,
    total,
    semExames: sem,
    semExamesPct: pct(sem, n),
    investigacaoIncompleta: inc,
    investigacaoIncompletaPct: pct(inc, n),
    doencaAvancada: adv,
    doencaAvancadaPct: pct(adv, n),
    incerteza: unc,
    incertezaPct: pct(unc, n),
    exames,
    municipios,
    certeza: dist(matched, "certainty"),
    drc: dist(matched, "drc"),
    sexo: dist(matched, "sexo"),
  };
}

/** Exportação científica: código P0001…, sem nome, e-mail ou CPF. */
export function anonymizeFirstVisit(rows: FirstVisitRecord[]): Array<Record<string, unknown>> {
  return rows.map((r, i) => {
    const code = `P${String(i + 1).padStart(4, "0")}`;
    const exams: Record<string, unknown> = {};
    for (const e of r.exames) {
      exams[`${e.key}_status`] = e.status;
      exams[`${e.key}_data`] = e.measuredAt ? String(e.measuredAt).slice(0, 10) : "";
      exams[`${e.key}_resultado`] = e.value || "";
      exams[`${e.key}_alterado`] = e.altered == null ? "" : e.altered ? "sim" : "nao";
      exams[`${e.key}_solicitado_apos`] = e.requestedAfter ? "sim" : "nao";
    }
    return {
      codigo: code,
      data_primeira_consulta: r.visitDate,
      certeza: r.certainty,
      motivo_certeza: r.certaintyReason,
      idade: r.idade,
      sexo: r.sexo,
      municipio: r.municipio,
      motivo: r.motivo,
      comorbidades: r.comorbidades,
      pressao_arterial: r.pa,
      medicamentos_previos: r.medicamentos,
      diagnostico_inicial: r.diagnostico,
      drc: r.drc,
      estagio_g: r.estagio_g,
      categoria_a: r.categoria_a,
      tfge: r.tfge,
      creatinina: r.creatinina,
      chegou_sem_exames: r.semExames ? "sim" : "nao",
      investigacao_incompleta: r.investigacaoIncompleta ? "sim" : "nao",
      doenca_renal_avancada: r.doencaAvancada ? "sim" : "nao",
      ...exams,
    };
  });
}
