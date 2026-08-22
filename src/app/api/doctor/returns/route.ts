import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { listReturnsByDoctor, setReturnStatus } from "@/lib/care-store";

type Eff = "atrasado" | "prox7" | "prox30" | "programado" | "agendado";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [returns, db] = await Promise.all([listReturnsByDoctor(doctorId, "open"), readDb()]);
  const now = Date.now();
  const in7 = now + 7 * 86400000;
  const in30 = now + 30 * 86400000;

  // Próxima consulta futura por paciente (a Agenda é a fonte da verdade).
  const futureByPatient = new Map<string, string>();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId || b.status === "cancelled") continue;
    if (new Date(b.slotStart).getTime() <= now) continue;
    const key = b.patientEmail.toLowerCase();
    const cur = futureByPatient.get(key);
    if (!cur || b.slotStart < cur) futureByPatient.set(key, b.slotStart);
  }
  const phoneByPatient = new Map<string, string>();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId) continue;
    if (b.patientPhone) phoneByPatient.set(b.patientEmail.toLowerCase(), b.patientPhone);
  }

  const items = returns.map((r) => {
    const future = futureByPatient.get(r.patientKey.toLowerCase()) || null;
    const due = new Date(r.dueAt).getTime();
    let eff: Eff;
    if (future) eff = "agendado";
    else if (due < now) eff = "atrasado";
    else if (due <= in7) eff = "prox7";
    else if (due <= in30) eff = "prox30";
    else eff = "programado";
    const daysLate = eff === "atrasado" ? Math.floor((now - due) / 86400000) : 0;
    return {
      id: r.id,
      patientKey: r.patientKey,
      patientName: r.patientName || r.patientKey,
      dueAt: r.dueAt,
      intervalLabel: r.intervalLabel,
      eff,
      daysLate,
      nextConsultation: future,
      phone: phoneByPatient.get(r.patientKey.toLowerCase()) || null,
    };
  });

  const buckets = {
    atrasados: items.filter((i) => i.eff === "atrasado").sort((a, b) => b.daysLate - a.daysLate),
    prox7: items.filter((i) => i.eff === "prox7").sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    prox30: items.filter((i) => i.eff === "prox30").sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    agendados: items.filter((i) => i.eff === "agendado").sort((a, b) => (a.nextConsultation || "").localeCompare(b.nextConsultation || "")),
  };
  return NextResponse.json({ buckets, pendentesCount: buckets.atrasados.length + buckets.prox7.length });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = body.status === "done" || body.status === "cancelled" ? body.status : null;
  if (!id || !status) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  await setReturnStatus(id, status, doctorId);
  return NextResponse.json({ ok: true });
}
