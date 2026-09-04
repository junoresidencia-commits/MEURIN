import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { addClinicalNote } from "@/lib/patient-store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { writeAudit } from "@/lib/patient-shares-store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const doctorId = await getDoctorSessionId();
    const { email: rawParam } = await params;
    const access = await resolvePatientAccess(rawParam);
    if (!access) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
    }

    const db = await readDb();
    const doctor = db.doctors.find((d) => d.id === doctorId);
    if (!doctor) {
      return NextResponse.json({ error: "Médico não encontrado." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const chiefComplaint = String(body.chiefComplaint || "").trim();
    const history = String(body.history || "").trim();
    const assessment = String(body.assessment || "").trim();
    const plan = String(body.plan || "").trim();

    if (!chiefComplaint && !history && !assessment && !plan) {
      return NextResponse.json({ error: "Escreva ao menos um campo da evolução." }, { status: 400 });
    }

    const note = await addClinicalNote({
      patientEmail: access.key,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty || null,
      chiefComplaint: chiefComplaint || null,
      history: history || null,
      assessment: assessment || null,
      plan: plan || null,
      sharedWithPatient: Boolean(body.sharedWithPatient),
    });

    try {
      await writeAudit({
        doctorId: doctor.id,
        doctorName: doctor.name,
        patientKey: access.key,
        action: "evolucao_criada",
        detail: doctor.specialty || null,
      });
    } catch (err) {
      console.error("[notes] audit", err);
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error("[notes] POST", err);
    return NextResponse.json(
      { error: "Não foi possível salvar a evolução. Tente novamente." },
      { status: 500 }
    );
  }
}
