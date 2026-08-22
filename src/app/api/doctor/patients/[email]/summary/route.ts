import { NextResponse } from "next/server";
import { getLabResults, getPatientData, latestOfKind } from "@/lib/patient-store";
import { getProfile } from "@/lib/clinical-profile-store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { ageFromBirthdate } from "@/lib/egfr";
import { NEPHRO_LABS } from "@/lib/labs";

type LatestLab = { value: number; unit: string | null; date: string; trend: "up" | "down" | "flat" | null };

// Resumo renal rápido — sempre com a DATA de cada valor. Nunca inventa dado ausente
// e nunca usa exame antigo como se fosse atual sem expor a data.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const [labs, patientData, profile] = await Promise.all([
    getLabResults(access.key),
    getPatientData(access.key, 120),
    getProfile(access.key),
  ]);

  const unitByKey = new Map(NEPHRO_LABS.map((l) => [l.key, l.unit]));

  // labs vêm em ordem crescente por data → o último de cada exame é o mais recente.
  const latest: Record<string, LatestLab> = {};
  const prevValue: Record<string, number> = {};
  for (const r of labs) {
    if (latest[r.testKey]) prevValue[r.testKey] = latest[r.testKey].value;
    latest[r.testKey] = {
      value: r.value,
      unit: r.unit || unitByKey.get(r.testKey) || null,
      date: r.measuredAt,
      trend: null,
    };
  }
  for (const key of Object.keys(latest)) {
    if (prevValue[key] != null) {
      const diff = latest[key].value - prevValue[key];
      const rel = prevValue[key] !== 0 ? Math.abs(diff / prevValue[key]) : Math.abs(diff);
      latest[key].trend = rel < 0.03 ? "flat" : diff > 0 ? "up" : "down";
    }
  }

  const records = patientData.records || [];
  const bp = latestOfKind(records, "bp");
  const weight = latestOfKind(records, "weight");

  // Consultas: última realizada (passado) e próxima (futuro).
  const now = Date.now();
  const past = access.bookings
    .filter((b) => new Date(b.slotStart).getTime() <= now && b.status !== "cancelled")
    .sort((a, b) => b.slotStart.localeCompare(a.slotStart));
  const future = access.bookings
    .filter((b) => new Date(b.slotStart).getTime() > now && b.status !== "cancelled")
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));

  // Alertas clínicos com motivo e data (regras conservadoras — apoio, não diagnóstico).
  const alerts: { level: "urgente" | "importante" | "atencao"; text: string; date: string }[] = [];
  const k = latest["potassio"];
  if (k) {
    if (k.value >= 6.0) alerts.push({ level: "urgente", text: `Potássio ${k.value} mEq/L (hipercalemia grave)`, date: k.date });
    else if (k.value >= 5.5) alerts.push({ level: "importante", text: `Potássio ${k.value} mEq/L (hipercalemia)`, date: k.date });
    else if (k.value <= 3.0) alerts.push({ level: "importante", text: `Potássio ${k.value} mEq/L (hipocalemia)`, date: k.date });
  }
  const tfge = latest["tfge"] || latest["tfge_cistatina"];
  if (tfge && tfge.value < 15) alerts.push({ level: "urgente", text: `TFGe ${tfge.value} mL/min/1,73m² (função muito reduzida)`, date: tfge.date });
  const hb = latest["hemoglobina"];
  if (hb && hb.value < 8) alerts.push({ level: "importante", text: `Hemoglobina ${hb.value} g/dL (anemia importante)`, date: hb.date });

  const drcG = (profile?.data?.["estagio_g"] as string) || null;
  const drcA = (profile?.data?.["categoria_a"] as string) || null;

  return NextResponse.json({
    patient: {
      name: access.name,
      city: access.city,
      age: ageFromBirthdate(access.birthdate),
      sex: access.sex,
    },
    drc: { g: drcG, a: drcA },
    labs: {
      tfge: latest["tfge"] || null,
      tfge_cistatina: latest["tfge_cistatina"] || null,
      creatinina: latest["creatinina"] || null,
      rac: latest["rac"] || null,
      proteinuria_24h: latest["proteinuria_24h"] || null,
      potassio: latest["potassio"] || null,
      hemoglobina: latest["hemoglobina"] || null,
    },
    vitals: {
      pa: bp && bp.systolic && bp.diastolic ? { text: `${bp.systolic}/${bp.diastolic}`, date: bp.measuredAt } : null,
      peso: weight && weight.weightKg ? { value: weight.weightKg, date: weight.measuredAt } : null,
    },
    lastConsultation: past[0]?.slotStart || null,
    nextConsultation: future[0]?.slotStart || null,
    alerts,
  });
}
