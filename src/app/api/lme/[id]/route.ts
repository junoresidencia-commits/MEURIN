import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getPatientEmail } from "@/lib/patient-session";
import { getLme } from "@/lib/lme-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lme = await getLme(id);
  if (!lme) {
    return NextResponse.json({ error: "LME não encontrada." }, { status: 404 });
  }

  const doctorId = await getDoctorSessionId();
  const patientEmail = await getPatientEmail();
  const isOwnerDoctor = doctorId && doctorId === lme.doctorId;
  const isPatient =
    patientEmail && lme.patientEmail.toLowerCase() === patientEmail.toLowerCase();

  if (!isOwnerDoctor && !isPatient) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  return NextResponse.json({ lme });
}
