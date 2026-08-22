import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { createReturn, finishAttendance, getOpenAttendanceForPatient, startAttendance } from "@/lib/care-store";

const INTERVAL_DAYS: Record<string, number> = { "15d": 15, "30d": 30, "60d": 60, "90d": 90, "6m": 182, "1a": 365 };

function dueFromInterval(label: string): string | null {
  const days = INTERVAL_DAYS[label];
  if (!days) return null;
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const doctorId = await getDoctorSessionId();
  const open = await getOpenAttendanceForPatient(doctorId!, access.key);
  return NextResponse.json({ open });
}

export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "start") {
    const att = await startAttendance({ doctorId, patientKey: access.key, bookingId: body.bookingId || null, patientName: access.name || null });
    return NextResponse.json({ ok: true, attendance: att });
  }

  if (action === "finish") {
    await finishAttendance({ doctorId, patientKey: access.key, bookingId: body.bookingId || null });
    // Próximo retorno (opcional): intervalo pré-definido ou data escolhida.
    const interval = String(body.returnInterval || "");
    let dueAt: string | null = null;
    let intervalLabel: string | null = null;
    if (interval && interval !== "sem") {
      if (interval === "data") {
        if (body.returnDate) {
          const d = new Date(String(body.returnDate));
          if (!Number.isNaN(d.getTime())) { dueAt = d.toISOString(); intervalLabel = "data"; }
        }
      } else {
        dueAt = dueFromInterval(interval);
        intervalLabel = interval;
      }
    }
    let createdReturn = null;
    if (dueAt) {
      createdReturn = await createReturn({ doctorId, patientKey: access.key, dueAt, intervalLabel, patientName: access.name || null, createdBy: doctorId });
    }
    return NextResponse.json({ ok: true, return: createdReturn });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
