import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { addClinicalNote } from "@/lib/patient-store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase().trim();

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  const hasAccess = db.bookings.some(
    (b) => b.doctorId === doctorId && b.patientEmail.toLowerCase() === email
  );
  if (!doctor || !hasAccess) {
    return NextResponse.json(
      { error: "Você não tem acesso a este paciente." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const chiefComplaint = String(body.chiefComplaint || "").trim();
  const history = String(body.history || "").trim();
  const assessment = String(body.assessment || "").trim();
  const plan = String(body.plan || "").trim();

  if (!chiefComplaint && !history && !assessment && !plan) {
    return NextResponse.json(
      { error: "Escreva ao menos um campo da evolução." },
      { status: 400 }
    );
  }

  const note = await addClinicalNote({
    patientEmail: email,
    doctorId,
    doctorName: doctor.name,
    chiefComplaint: chiefComplaint || null,
    history: history || null,
    assessment: assessment || null,
    plan: plan || null,
    sharedWithPatient: Boolean(body.sharedWithPatient),
  });

  return NextResponse.json({ note }, { status: 201 });
}
