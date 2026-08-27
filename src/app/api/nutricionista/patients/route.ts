import { NextResponse } from "next/server";
import { requireNutritionist, linkedDoctorIds } from "@/lib/nutrition-context";
import { listReferralsForDoctorIds } from "@/lib/nutritionists-store";
import { getPatient, clinicalKey, findByEmailAny } from "@/lib/patients-store";

export async function GET(req: Request) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctorIds = await linkedDoctorIds(nut.id);
  const q = (new URL(req.url).searchParams.get("q") || "").toLowerCase().trim();

  const refs = (await listReferralsForDoctorIds(doctorIds)).filter((r) =>
    r.status !== "encerrado" && (r.nutritionistId === nut.id || !r.nutritionistId)
  );

  const seen = new Set<string>();
  const patients: { key: string; name: string; cpf: string | null; doctorId: string }[] = [];
  for (const r of refs) {
    if (seen.has(r.patientKey)) continue;
    seen.add(r.patientKey);
    let patient = null as Awaited<ReturnType<typeof getPatient>>;
    if (r.patientKey.startsWith("pid:")) patient = await getPatient(r.patientKey.slice(4));
    else if (r.patientKey.includes("@")) patient = await findByEmailAny(r.patientKey);
    patients.push({
      key: patient ? clinicalKey(patient) : r.patientKey,
      name: patient?.name || r.patientName || "Paciente",
      cpf: patient?.cpf ?? null,
      doctorId: r.doctorId,
    });
  }

  const filtered = q
    ? patients.filter((p) => p.name.toLowerCase().includes(q) || (p.cpf || "").includes(q))
    : patients;

  return NextResponse.json({
    patients: filtered.sort((a, b) => a.name.localeCompare(b.name)),
    referrals: refs.map((r) => ({
      id: r.id, patientKey: r.patientKey, patientName: r.patientName, reason: r.reason,
      objective: r.objective, priority: r.priority, status: r.status, doctorName: r.doctorName, createdAt: r.createdAt,
    })),
  });
}
