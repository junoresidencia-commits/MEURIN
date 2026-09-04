import { NextResponse } from "next/server";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { findPatientByClinicalKey } from "@/lib/patients-store";
import { listActiveSharesForPatient, listAudit } from "@/lib/patient-shares-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  const access = await resolvePatientAccess(decodeURIComponent(email));
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });

  const shares = await listActiveSharesForPatient(access.key);
  const extra = access.email && access.email !== access.key ? await listActiveSharesForPatient(access.email) : [];
  const merged = [...shares];
  for (const s of extra) {
    if (!merged.some((x) => x.id === s.id)) merged.push(s);
  }

  const patient = await findPatientByClinicalKey(access.key);
  const owner = patient ? await getDoctorById(patient.doctorId) : null;
  const audit = await listAudit(access.key);

  return NextResponse.json({
    patientKey: access.key,
    owner: owner
      ? { id: owner.id, name: owner.name, specialty: owner.specialty, crm: owner.crm }
      : null,
    shares: merged,
    audit,
  });
}
