import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getPatientEmail } from "@/lib/patient-session";
import { getDocumentById } from "@/lib/patient-store";
import { getDoctorById } from "@/lib/store";
import { patientCanViewSharedDocument } from "@/lib/nutrition-plan-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const doctorId = await getDoctorSessionId();
  const patientEmail = await getPatientEmail();

  const isOwnerDoctor = doctorId && doctorId === doc.doctorId;
  const isPatientAllowed = patientEmail
    ? await patientCanViewSharedDocument(doc, patientEmail)
    : false;

  if (!isOwnerDoctor && !isPatientAllowed) {
    const unpaidPlan = patientEmail
      && patientEmail.toLowerCase() === doc.patientEmail.toLowerCase()
      && doc.sharedWithPatient
      && doc.type === "plano_alimentar";
    return NextResponse.json(
      { error: unpaidPlan ? "O plano alimentar é liberado após a confirmação do pagamento da consulta." : "Sem acesso a este documento." },
      { status: 403 }
    );
  }

  // Anexa a logo do médico emissor para o cabeçalho do documento/PDF.
  const doctor = await getDoctorById(doc.doctorId);
  return NextResponse.json({
    document: { ...doc, doctorLogoUrl: doctor?.logoUrl ?? null },
  });
}
