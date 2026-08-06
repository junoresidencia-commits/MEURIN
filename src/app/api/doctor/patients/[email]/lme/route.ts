import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { createLme, type LmeMedication } from "@/lib/lme-store";
import { resolvePatientAccess } from "@/lib/doctor-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const doctorId = await getDoctorSessionId();
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  const b = await req.json();

  const medications: LmeMedication[] = Array.isArray(b.medications)
    ? b.medications
        .filter((m: { name?: string }) => m && String(m.name || "").trim())
        .map((m: { name: string; presentation?: string; monthlyQty?: string }) => ({
          name: String(m.name),
          presentation: m.presentation ? String(m.presentation) : "",
          monthlyQty: m.monthlyQty ? String(m.monthlyQty) : "",
        }))
    : [];

  if (medications.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um medicamento." }, { status: 400 });
  }
  if (!String(b.cid10 || "").trim()) {
    return NextResponse.json({ error: "Informe o CID-10." }, { status: 400 });
  }

  const lme = await createLme({
    patientEmail: access.key,
    doctorId: doctor?.id ?? null,
    doctorName: doctor?.name ?? null,
    doctorCrm: doctor?.crm ?? null,
    doctorCns: b.doctorCns ? String(b.doctorCns) : null,
    establishmentName: b.establishmentName ? String(b.establishmentName) : null,
    cnes: b.cnes ? String(b.cnes) : null,
    patientName: b.patientName ? String(b.patientName) : access.name,
    motherName: b.motherName ? String(b.motherName) : null,
    weightKg: b.weightKg ? Number(String(b.weightKg).replace(",", ".")) : null,
    heightCm: b.heightCm ? Number(String(b.heightCm).replace(",", ".")) : null,
    patientCpf: b.patientCpf ? String(b.patientCpf) : null,
    patientCns: b.patientCns ? String(b.patientCns) : null,
    patientPhone: b.patientPhone ? String(b.patientPhone) : access.phone,
    patientEmailContact: access.email || null,
    race: b.race ? String(b.race) : null,
    cid10: String(b.cid10),
    diagnosis: b.diagnosis ? String(b.diagnosis) : null,
    anamnesis: b.anamnesis ? String(b.anamnesis) : null,
    priorTreatment: Boolean(b.priorTreatment),
    priorTreatmentDesc: b.priorTreatmentDesc ? String(b.priorTreatmentDesc) : null,
    incapable: Boolean(b.incapable),
    responsibleName: b.responsibleName ? String(b.responsibleName) : null,
    medications,
    status: "rascunho",
  });

  return NextResponse.json({ ok: true, id: lme.id, lme }, { status: 201 });
}
