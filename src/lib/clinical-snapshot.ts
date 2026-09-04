import "server-only";
import { getProfile } from "./clinical-profile-store";
import { computeImc, etiologiaLabel, ckmEstadioLabel } from "./clinical-fields";
import { getLabResults, getPatientData } from "./patient-store";
import { getPatient } from "./patients-store";
import { NEPHRO_LABS } from "./labs";
import type { AlliedRole } from "./allied-types";

const NUTRI_LABS = ["creatinina", "tfge", "ureia", "potassio", "fosforo", "calcio", "albumina", "hemoglobina", "proteinuria_24h", "rac", "glicemia", "glicemia_jejum", "hba1c"];
const NURSE_LABS = ["creatinina", "tfge", "ureia", "potassio", "calcio", "fosforo", "albumina", "hemoglobina", "pth", "glicemia", "glicemia_jejum"];
const PSY_LABS: string[] = [];

function labsFor(role: AlliedRole | "nutrition" | "doctor"): string[] {
  if (role === "nutrition") return NUTRI_LABS;
  if (role === "nursing" || role === "doctor") return NURSE_LABS;
  return PSY_LABS;
}

function ageYears(birthdate?: string | null): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export async function buildClinicalSnapshot(patientKey: string, role: AlliedRole | "nutrition" | "doctor") {
  const pid = patientKey.startsWith("pid:") ? patientKey.slice(4) : null;
  const patient = pid ? await getPatient(pid) : null;
  const [profile, labsAll, home] = await Promise.all([
    getProfile(patientKey),
    getLabResults(patientKey),
    getPatientData(patientKey).catch(() => ({ records: [] as { kind: string; systolic?: number | null; diastolic?: number | null; heartRate?: number | null; glucoseMgDl?: number | null; weightKg?: number | null; measuredAt: string }[] })),
  ]);
  const data = (profile?.data ?? {}) as Record<string, unknown>;
  const allow = new Set(labsFor(role));
  const labelByKey = new Map(NEPHRO_LABS.map((l) => [l.key, l]));
  const latest = new Map<string, { key: string; label: string; value: number; unit?: string; measuredAt: string }>();
  for (const r of labsAll) {
    if (role !== "doctor" && !allow.has(r.testKey)) continue;
    if (role === "psychology") continue;
    const prev = latest.get(r.testKey);
    if (!prev || r.measuredAt > prev.measuredAt) {
      const def = labelByKey.get(r.testKey);
      latest.set(r.testKey, { key: r.testKey, label: def?.label || r.testKey, value: r.value, unit: r.unit || def?.unit, measuredAt: r.measuredAt });
    }
  }
  const records = home.records || [];
  const bp = records.find((r) => r.kind === "bp");
  const glu = records.find((r) => r.kind === "glucose");
  const wt = records.find((r) => r.kind === "weight");

  return {
    identification: {
      name: patient?.name || "",
      birthdate: patient?.birthdate || null,
      age: ageYears(patient?.birthdate),
      sex: patient?.sex || null,
      cpf: patient?.cpf || null,
      allergies: (data.alergias as string) || patient?.allergies || null,
    },
    anthropometry: {
      pesoKg: data.peso_kg ?? wt?.weightKg ?? null,
      alturaCm: data.altura_cm ?? null,
      imc: computeImc(data),
    },
    renal: {
      drc: data.drc ?? null,
      estagioG: data.estagio_g ?? null,
      categoriaA: data.categoria_a ?? null,
      etiologia: etiologiaLabel(String(data.etiologia_principal || "")) || null,
      hemodialise: data.hemodialise ?? null,
      dialisePeritoneal: data.dialise_peritoneal ?? null,
    },
    comorbidities: {
      has: data.has ?? null,
      dm: data.dm ?? null,
      ic: data.ic ?? null,
      dcv: data.dcv ?? null,
      ckm: data.ckm ?? null,
      ckmEstadio: ckmEstadioLabel(String(data.ckm_estadio || "")) || null,
    },
    medications: String(data.medicamentos_em_uso || patient?.medications || ""),
    vitals: {
      pa: bp && bp.systolic ? `${bp.systolic}/${bp.diastolic}` : null,
      fc: bp?.heartRate ?? null,
      glicemia: glu?.glucoseMgDl ?? null,
      pesoCasa: wt?.weightKg ?? null,
      measuredAt: bp?.measuredAt || glu?.measuredAt || wt?.measuredAt || null,
    },
    labs: Array.from(latest.values()).sort((a, b) => a.label.localeCompare(b.label)),
    labsHistory: role === "psychology" ? [] : labsAll
      .filter((r) => role === "doctor" || allow.has(r.testKey))
      .slice(0, 80)
      .map((r) => ({ key: r.testKey, label: labelByKey.get(r.testKey)?.label || r.testKey, value: r.value, unit: r.unit, measuredAt: r.measuredAt })),
  };
}

export function isPdPatient(snapshot: { renal: { dialisePeritoneal: unknown } }): boolean {
  const v = snapshot.renal.dialisePeritoneal;
  return v === true || v === "sim";
}
