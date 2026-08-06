import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { addDocument, type DocumentType } from "@/lib/patient-store";

const TYPES: DocumentType[] = ["receita", "exame", "relatorio"];
const DEFAULT_TITLE: Record<DocumentType, string> = {
  receita: "Receita médica",
  exame: "Solicitação de exames",
  relatorio: "Relatório médico",
};

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
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const bodyReq = await req.json();
  const type = String(bodyReq.type) as DocumentType;
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
  }
  const body = String(bodyReq.body || "").trim();
  if (!body) {
    return NextResponse.json({ error: "Escreva o conteúdo do documento." }, { status: 400 });
  }

  const doc = await addDocument({
    patientEmail: email,
    doctorId,
    doctorName: doctor.name,
    doctorCrm: doctor.crm,
    type,
    title: String(bodyReq.title || "").trim() || DEFAULT_TITLE[type],
    body,
    sharedWithPatient: bodyReq.sharedWithPatient !== false,
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
