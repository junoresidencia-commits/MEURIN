import { NextResponse } from "next/server";
import { requireNutritionist, resolveNutritionPatientAccess } from "@/lib/nutrition-context";
import { getLabResults } from "@/lib/patient-store";
import { getProfile } from "@/lib/clinical-profile-store";
import { computeImc } from "@/lib/clinical-fields";
import { NEPHRO_LABS } from "@/lib/labs";
import { listConsultationsForPatient, getNutritionLink } from "@/lib/nutritionists-store";

// Exames relevantes para a avaliação nutricional renal.
const RELEVANT = ["creatinina", "tfge", "potassio", "fosforo", "calcio", "albumina", "ureia", "glicemia", "glicemia_jejum", "hba1c", "colesterol_total", "ldl", "hdl", "triglicerideos", "proteinuria_24h", "rac"];

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const patientKey = decodeURIComponent(key);
  const access = await resolveNutritionPatientAccess(patientKey);
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const nut = await requireNutritionist();
  const link = nut ? await getNutritionLink(nut.id, access.doctorId) : null;
  const canSeeLabs = !link || link.permissions.verExames;

  const [labsAll, profile, consultations] = await Promise.all([
    canSeeLabs ? getLabResults(access.key) : Promise.resolve([]),
    getProfile(access.key),
    listConsultationsForPatient(access.key),
  ]);
  const labs = labsAll;

  // Último valor por exame relevante.
  const labelByKey = new Map(NEPHRO_LABS.map((l) => [l.key, l]));
  const latest = new Map<string, { key: string; label: string; value: number; unit?: string; measuredAt: string }>();
  for (const r of labs) {
    if (!RELEVANT.includes(r.testKey)) continue;
    const prev = latest.get(r.testKey);
    if (!prev || r.measuredAt > prev.measuredAt) {
      const def = labelByKey.get(r.testKey);
      latest.set(r.testKey, { key: r.testKey, label: def?.label || r.testKey, value: r.value, unit: r.unit || def?.unit, measuredAt: r.measuredAt });
    }
  }
  const data = (profile?.data ?? {}) as Record<string, unknown>;
  const imc = profile ? computeImc(profile.data) : null;

  return NextResponse.json({
    patient: { key: access.key, name: access.name, birthdate: access.birthdate, sex: access.sex, cpf: access.cpf },
    renal: {
      drc: data.drc ?? null,
      estagioG: data.estagio_g ?? null,
      categoriaA: data.categoria_a ?? null,
      etiologia: data.etiologia_principal ?? null,
      pesoKg: data.peso_kg ?? null,
      alturaCm: data.altura_cm ?? null,
      imc: imc ?? null,
    },
    labs: Array.from(latest.values()).sort((a, b) => a.label.localeCompare(b.label)),
    consultations: consultations.map((c) => ({ id: c.id, createdAt: c.createdAt, nutritionistName: c.nutritionistName, plan: c.plan, assessment: c.assessment, sharedWithPatient: c.sharedWithPatient })),
  });
}
