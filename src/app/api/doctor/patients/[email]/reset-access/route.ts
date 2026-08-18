import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getPatient, findByEmailAny, resetPatientAccess } from "@/lib/patients-store";

// Médico redefine o acesso do paciente para a senha provisória 123456.
// No próximo login, o paciente será obrigado a criar uma nova senha pessoal.
export async function POST(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const param = decodeURIComponent(email);
  const access = await resolvePatientAccess(param);
  if (!access || !access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const patient = param.includes("@") ? await findByEmailAny(param) : await getPatient(param);
  if (!patient) {
    return NextResponse.json({ error: "Redefinição disponível apenas para pacientes cadastrados (com CPF)." }, { status: 400 });
  }
  await resetPatientAccess(patient.id);
  return NextResponse.json({ ok: true, cpf: patient.cpf ? String(patient.cpf).replace(/\D/g, "") : null });
}
