import { NextResponse } from "next/server";
import { requireAttendantForDoctor, hasPerm } from "@/lib/attendant-context";
import { readDb, updateBooking, getDoctorById } from "@/lib/store";
import { logAttendantAudit } from "@/lib/attendants-store";
import { sendNotification, patientKey, links, fmtDateTime } from "@/lib/notify";
import { confirmBookingPaid } from "@/lib/payments";
import type { ConsultationEvent } from "@/lib/types";

function ev(actor: ConsultationEvent["actor"], type: string, detail?: string): ConsultationEvent {
  return { at: new Date().toISOString(), actor, type, detail };
}
function isFutureIso(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(new Date(v).getTime());
}

export async function PATCH(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  const id = String(b.id || "");
  const action = String(b.action || "");
  if (!doctorId || !id) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });

  const db = await readDb();
  const booking = db.bookings.find((x) => x.id === id && x.doctorId === doctorId);
  const doctor = await getDoctorById(doctorId);
  if (!booking || !doctor) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  const events = booking.events ?? [];
  const who = `${ctx.attendant.name} (atendente)`;

  if (action === "mark_paid") {
    if (!hasPerm(ctx.link, "confirmar")) return deny();
    if (booking.status !== "pending_payment") {
      return NextResponse.json({ error: "Esta consulta não está aguardando pagamento." }, { status: 400 });
    }
    const result = await confirmBookingPaid(id, { markedBy: "atendente" });
    if (!result?.booking) return NextResponse.json({ error: "Não foi possível registrar o pagamento." }, { status: 500 });
    await audit("confirmar", "Marcou o pagamento como recebido.");
    return NextResponse.json({ ok: true, booking: result.booking });
  }

  if (action === "confirm") {
    if (!hasPerm(ctx.link, "confirmar")) return deny();
    const updated = await updateBooking(id, {
      status: "confirmed", stage: "confirmada",
      events: [...events, ev("medico", "confirmada", `Confirmada por ${who}.`)],
    });
    await audit("confirmar", "Confirmou a consulta.");
    if (booking.patientEmail) await notifyPatient("consulta_confirmada", "Consulta confirmada", `Sua consulta está confirmada para ${fmtDateTime(booking.slotStart, doctor.tz)}.`);
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "reschedule") {
    if (!hasPerm(ctx.link, "remarcar")) return deny();
    if (!isFutureIso(b.slotStart) || !isFutureIso(b.slotEnd)) return NextResponse.json({ error: "Informe a nova data e horário." }, { status: 400 });
    const toLabel = fmtDateTime(String(b.slotStart), doctor.tz);
    const updated = await updateBooking(id, {
      slotStart: String(b.slotStart), slotEnd: String(b.slotEnd),
      stage: booking.status === "confirmed" ? "confirmada" : "remarcada",
      reminder24Sent: false, reminder2Sent: false,
      events: [...events, ev("medico", "remarcada", `Remarcada por ${who} para ${toLabel}.`)],
    });
    await audit("remarcar", `Remarcou para ${toLabel}.`);
    if (booking.patientEmail) await notifyPatient("consulta_remarcada", "Consulta remarcada", `Sua consulta foi remarcada para ${toLabel}.`);
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "cancel") {
    if (!hasPerm(ctx.link, "cancelar")) return deny();
    const reason = typeof b.reason === "string" ? b.reason : "";
    const updated = await updateBooking(id, {
      status: "cancelled", stage: "cancelada", reminder24Sent: true, reminder2Sent: true,
      events: [...events, ev("medico", "cancelada", `Cancelada por ${who}.${reason ? " Motivo: " + reason : ""}`)],
    });
    await audit("cancelar", `Cancelou a consulta.${reason ? " Motivo: " + reason : ""}`);
    if (booking.patientEmail) await notifyPatient("consulta_cancelada", "Consulta cancelada", `Sua consulta de ${fmtDateTime(booking.slotStart, doctor.tz)} foi cancelada.`);
    return NextResponse.json({ ok: true, booking: updated });
  }

  if (action === "not_realized") {
    if (!hasPerm(ctx.link, "ausencia")) return deny();
    const reason = typeof b.reason === "string" ? b.reason.trim() : "nao_compareceu";
    const updated = await updateBooking(id, {
      stage: "nao_realizada", notRealizedReason: reason,
      events: [...events, ev("medico", "nao_realizada", `Registrada ausência por ${who} (${reason}).`)],
    });
    await audit("ausencia", `Registrou ausência (${reason}).`);
    return NextResponse.json({ ok: true, booking: updated });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

  function deny() { return NextResponse.json({ error: "Sem permissão para esta ação." }, { status: 403 }); }
  async function audit(act: string, detail: string) {
    await logAttendantAudit({ attendantId: ctx!.attendant.id, attendantName: ctx!.attendant.name, doctorId, action: act, bookingId: id, patientKey: booking!.patientEmail, detail });
  }
  async function notifyPatient(type: string, title: string, body: string) {
    await sendNotification({ userId: patientKey(booking!.patientEmail), role: "paciente", type, title, body, targetUrl: links.patientConsulta(id), tag: `booking-${id}`, relatedType: "booking", relatedId: id });
  }
}
