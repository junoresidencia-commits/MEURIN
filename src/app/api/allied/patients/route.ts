import { NextResponse } from "next/server";
import { requireAllied } from "@/lib/allied-access";
import { listReferralsForProfessional, listActiveDoctorIdsForProfessional } from "@/lib/allied-store";

export async function GET() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctorIds = await listActiveDoctorIdsForProfessional(pro.id);
  const referrals = (await listReferralsForProfessional(pro.id))
    .filter((r) => r.status !== "encerrado" && doctorIds.includes(r.doctorId));
  const seen = new Set<string>();
  const patients: { key: string; name: string; reason?: string | null; at: string }[] = [];
  for (const r of referrals) {
    if (seen.has(r.patientKey)) continue;
    seen.add(r.patientKey);
    patients.push({ key: r.patientKey, name: r.patientName || "Paciente", reason: r.reason, at: r.createdAt });
  }
  return NextResponse.json({
    patients: patients.sort((a, b) => a.name.localeCompare(b.name)),
    referrals: referrals.filter((r) => r.status === "aberto"),
  });
}
