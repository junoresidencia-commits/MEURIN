import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { createReturn } from "@/lib/care-store";

// Define o próximo retorno do paciente contado a partir de HOJE (data do atendimento).
const INTERVAL_DAYS: Record<string, number> = { "15d": 15, "30d": 30, "3m": 90, "6m": 182, "1a": 365 };

export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const interval = String(body.interval || "");
  let dueAt: string | null = null;
  let intervalLabel: string | null = null;

  if (interval === "data" && body.dueDate) {
    const d = new Date(String(body.dueDate));
    if (!Number.isNaN(d.getTime())) { dueAt = d.toISOString(); intervalLabel = "data"; }
  } else if (INTERVAL_DAYS[interval]) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + INTERVAL_DAYS[interval]);
    dueAt = d.toISOString();
    intervalLabel = interval;
  }
  if (!dueAt) return NextResponse.json({ error: "Intervalo de retorno inválido." }, { status: 400 });

  const ret = await createReturn({
    doctorId,
    patientKey: access.key,
    dueAt,
    intervalLabel,
    patientName: access.name || null,
    createdBy: doctorId,
  });
  return NextResponse.json({ ok: true, return: ret });
}
