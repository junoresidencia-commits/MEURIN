import { NextResponse } from "next/server";
import { requireAllied } from "@/lib/allied-access";
import { listReferralsForProfessional, listActiveDoctorIdsForProfessional } from "@/lib/allied-store";
import { listLinksForProfessional } from "@/lib/network-referrals-store";

export async function GET() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctorIds = await listActiveDoctorIdsForProfessional(pro.id);
  const referrals = (await listReferralsForProfessional(pro.id))
    .filter((r) => r.status !== "encerrado" && (!doctorIds.length || doctorIds.includes(r.doctorId)));
  const seen = new Set<string>();
  const patients: { key: string; name: string; reason?: string | null; at: string }[] = [];
  for (const r of referrals) {
    if (seen.has(r.patientKey)) continue;
    seen.add(r.patientKey);
    patients.push({ key: r.patientKey, name: r.patientName || "Paciente", reason: r.reason, at: r.createdAt });
  }
  const links = await listLinksForProfessional(pro.role, pro.id);
  for (const link of links) {
    if (seen.has(link.patientKey)) continue;
    seen.add(link.patientKey);
    patients.push({ key: link.patientKey, name: link.patientName || "Paciente", reason: link.origin === "registered" ? "Cadastro próprio" : "Acompanhamento", at: link.createdAt });
  }
  return NextResponse.json({
    patients: patients.sort((a, b) => a.name.localeCompare(b.name)),
    referrals: referrals.filter((r) => r.status === "aberto"),
  });
}
