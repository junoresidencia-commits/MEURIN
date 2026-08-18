import { NextResponse } from "next/server";
import { requireNutritionist, linkedDoctorIds } from "@/lib/nutrition-context";
import { listReferralsForDoctorIds } from "@/lib/nutritionists-store";
import { listPatientsByDoctor, clinicalKey } from "@/lib/patients-store";

export async function GET(req: Request) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctorIds = await linkedDoctorIds(nut.id);
  const q = (new URL(req.url).searchParams.get("q") || "").toLowerCase().trim();

  // Pacientes cadastrados pelos médicos vinculados.
  const seen = new Set<string>();
  const patients: { key: string; name: string; cpf: string | null; doctorId: string }[] = [];
  for (const did of doctorIds) {
    const list = await listPatientsByDoctor(did);
    for (const p of list) {
      const key = clinicalKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      patients.push({ key, name: p.name, cpf: p.cpf ?? null, doctorId: did });
    }
  }
  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q) || (p.cpf || "").includes(q)) : patients;

  // Encaminhamentos abertos dos médicos vinculados.
  const referrals = (await listReferralsForDoctorIds(doctorIds)).map((r) => ({
    id: r.id, patientKey: r.patientKey, patientName: r.patientName, reason: r.reason,
    objective: r.objective, priority: r.priority, status: r.status, doctorName: r.doctorName, createdAt: r.createdAt,
  }));

  return NextResponse.json({ patients: filtered.sort((a, b) => a.name.localeCompare(b.name)), referrals });
}
