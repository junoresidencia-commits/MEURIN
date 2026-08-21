import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getPatient, findByEmailAny, updatePatient } from "@/lib/patients-store";

// Ajuste rápido de dados demográficos do paciente (ex.: definir sexo) a partir da Pesquisa.
export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const param = decodeURIComponent(email);
  const access = await resolvePatientAccess(param);
  if (!access || !access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const patch: { sex?: string; birthdate?: string } = {};
  if (b.sex !== undefined) {
    const s = String(b.sex).toLowerCase();
    if (s === "masculino" || s === "feminino") patch.sex = s;
    else return NextResponse.json({ error: "Sexo deve ser masculino ou feminino." }, { status: 400 });
  }
  if (b.birthdate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(b.birthdate))) patch.birthdate = String(b.birthdate);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const patient = param.includes("@") ? await findByEmailAny(param) : await getPatient(param);
  if (!patient) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  await updatePatient(patient.id, patch);
  return NextResponse.json({ ok: true });
}
