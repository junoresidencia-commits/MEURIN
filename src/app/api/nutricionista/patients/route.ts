import { NextResponse } from "next/server";
import { requireNutritionist, linkedDoctorIds } from "@/lib/nutrition-context";
import { listReferralsForDoctorIds } from "@/lib/nutritionists-store";
import { getDoctorById } from "@/lib/store";
import { clinicalKey, lookupPatientByKey } from "@/lib/patients-store";

export async function GET(req: Request) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctorIds = await linkedDoctorIds(nut.id);
  const q = (new URL(req.url).searchParams.get("q") || "").toLowerCase().trim();

  const refs = (await listReferralsForDoctorIds(doctorIds)).filter((r) =>
    r.status !== "encerrado" && (r.nutritionistId === nut.id || !r.nutritionistId)
  );

  const doctorNames = new Map<string, string>();
  for (const id of [...new Set(refs.map((r) => r.doctorId))]) {
    if (!id) continue;
    const doc = await getDoctorById(id);
    if (doc?.name) doctorNames.set(id, doc.name);
  }

  const seen = new Set<string>();
  const patients: { key: string; name: string; cpf: string | null; doctorId: string; doctorName: string | null }[] = [];
  const hydratedRefs = [];
  for (const r of refs) {
    const patient = await lookupPatientByKey(r.patientKey);
    const name = patient?.name || r.patientName || "Paciente";
    const doctorName = r.doctorName || doctorNames.get(r.doctorId) || null;
    hydratedRefs.push({
      id: r.id,
      patientKey: patient ? clinicalKey(patient) : r.patientKey,
      patientName: name,
      reason: r.reason,
      objective: r.objective,
      priority: r.priority,
      status: r.status,
      doctorName,
      createdAt: r.createdAt,
    });
    if (seen.has(r.patientKey)) continue;
    seen.add(r.patientKey);
    patients.push({
      key: patient ? clinicalKey(patient) : r.patientKey,
      name,
      cpf: patient?.cpf ?? null,
      doctorId: r.doctorId,
      doctorName,
    });
  }

  const filtered = q
    ? patients.filter((p) => p.name.toLowerCase().includes(q) || (p.cpf || "").includes(q))
    : patients;

  return NextResponse.json({
    patients: filtered.sort((a, b) => a.name.localeCompare(b.name)),
    referrals: hydratedRefs,
  });
}
