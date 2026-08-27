import { NextResponse } from "next/server";
import { requireAllied } from "@/lib/allied-access";
import { listReferralsForProfessional, listActiveDoctorIdsForProfessional } from "@/lib/allied-store";
import { getDoctorById } from "@/lib/store";
import { clinicalKey, lookupPatientByKey } from "@/lib/patients-store";

export async function GET() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctorIds = await listActiveDoctorIdsForProfessional(pro.id);
  const referrals = (await listReferralsForProfessional(pro.id))
    .filter((r) => r.status !== "encerrado" && doctorIds.includes(r.doctorId));

  const doctorNames = new Map<string, string>();
  for (const id of [...new Set(referrals.map((r) => r.doctorId))]) {
    if (!id) continue;
    const doc = await getDoctorById(id);
    if (doc?.name) doctorNames.set(id, doc.name);
  }

  const hydrated = [];
  for (const r of referrals) {
    const patient = await lookupPatientByKey(r.patientKey);
    const name = patient?.name || r.patientName || "Paciente";
    const doctorName = r.doctorName || doctorNames.get(r.doctorId) || "médico";
    hydrated.push({
      ...r,
      patientKey: patient ? clinicalKey(patient) : r.patientKey,
      patientName: name,
      doctorName,
    });
  }

  const seen = new Set<string>();
  const patients: { key: string; name: string; reason?: string | null; doctorName?: string | null; at: string }[] = [];
  for (const r of hydrated) {
    if (seen.has(r.patientKey)) continue;
    seen.add(r.patientKey);
    patients.push({ key: r.patientKey, name: r.patientName, reason: r.reason, doctorName: r.doctorName, at: r.createdAt });
  }

  return NextResponse.json({
    patients: patients.sort((a, b) => a.name.localeCompare(b.name)),
    referrals: hydrated.filter((r) => r.status === "aberto"),
  });
}
