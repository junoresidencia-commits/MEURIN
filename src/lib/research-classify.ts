import "server-only";
import { classifyFromLabs } from "./kdigo";
import { estimateEgfr } from "./egfr";
import { listPatientsByDoctor, clinicalKey, findPatientByClinicalKey } from "./patients-store";
import { getLabResults, addLabResult, getClinicalNotes } from "./patient-store";
import { applyProfileChanges, getProfile } from "./clinical-profile-store";
import { extractClinicalFields, splitByConfidence } from "./clinical-intelligence";

export type ClassifyAllResult = {
  total: number;
  classified: number;
  drc: number;
  g: number;
  a: number;
  tfgeComputed: number;
};

const KIDNEY_KEYS = new Set(["drc", "estagio_g", "categoria_a"]);

function unknown(v: unknown): boolean {
  return v === undefined || v === null || v === "" || v === "desconhecido";
}

function noteText(n: { chiefComplaint?: string | null; history?: string | null; assessment?: string | null; plan?: string | null }) {
  return [n.chiefComplaint, n.history, n.assessment, n.plan].filter(Boolean).join("\n");
}

/** Revisa todos os pacientes do médico e grava DRC / G / A a partir dos exames (e da evolução, se faltar). */
export async function classifyAllPatientsForDoctor(doctorId: string, by = "sistema"): Promise<ClassifyAllResult> {
  const patients = (await listPatientsByDoctor(doctorId)).filter((p) => p.status !== "archived");
  const summary: ClassifyAllResult = { total: patients.length, classified: 0, drc: 0, g: 0, a: 0, tfgeComputed: 0 };

  for (const p of patients) {
    const key = clinicalKey(p);
    const [labs, current, notes, cadastro] = await Promise.all([
      getLabResults(key),
      getProfile(key),
      getClinicalNotes(key),
      findPatientByClinicalKey(key),
    ]);
    const data = current?.data || {};
    const changes: Record<string, unknown> = {};

    const cls = classifyFromLabs({
      labs,
      birthdate: p.birthdate,
      sex: p.sex,
      ageYears: p.ageYears,
      ageReportedAt: p.ageReportedAt,
      computeTfge: (cr, at) => estimateEgfr(cr, p.birthdate, p.sex, at, { ageYears: p.ageYears, ageReportedAt: p.ageReportedAt }),
    });
    if (cls.estagio_g && unknown(data.estagio_g)) changes.estagio_g = cls.estagio_g;
    if (cls.categoria_a && unknown(data.categoria_a)) changes.categoria_a = cls.categoria_a;
    if (cls.drc && unknown(data.drc)) changes.drc = cls.drc;

    if (
      (unknown(data.estagio_g) && !changes.estagio_g) ||
      (unknown(data.categoria_a) && !changes.categoria_a) ||
      (unknown(data.drc) && !changes.drc)
    ) {
      const blob = [
        cadastro?.diseases,
        cadastro?.medications,
        cadastro?.allergies,
        cadastro?.notes,
        ...notes.map(noteText),
      ]
        .filter(Boolean)
        .join("\n\n");
      const detected = extractClinicalFields(
        blob,
        labs.map((l) => ({ testKey: l.testKey, value: l.value, measuredAt: l.measuredAt })),
        data
      );
      const { auto } = splitByConfidence(detected);
      for (const d of auto) {
        if (!KIDNEY_KEYS.has(d.key)) continue;
        if (!unknown(data[d.key]) || changes[d.key] != null) continue;
        changes[d.key] = d.value;
      }
    }

    if (Object.keys(changes).length) {
      await applyProfileChanges(key, doctorId, by, changes, "cálculo");
      summary.classified += 1;
      if (changes.drc) summary.drc += 1;
      if (changes.estagio_g) summary.g += 1;
      if (changes.categoria_a) summary.a += 1;
    } else if (cls.estagio_g || cls.categoria_a || cls.drc) {
      summary.classified += 1;
    }

    const hasTfgeLab = labs.some((l) => l.testKey === "tfge" || l.testKey === "tfge_cistatina");
    if (!hasTfgeLab && cls.tfge != null && cls.tfgeSource === "calculado") {
      const cr = [...labs].reverse().find((l) => l.testKey === "creatinina");
      await addLabResult({
        patientEmail: key,
        doctorId,
        testKey: "tfge",
        value: cls.tfge,
        unit: "mL/min/1,73m²",
        origin: "cálculo",
        meta: { equation: "CKD-EPI", version: "2021", from: "creatinina" },
        measuredAt: cr?.measuredAt || new Date().toISOString(),
      });
      summary.tfgeComputed += 1;
    }
  }
  return summary;
}
