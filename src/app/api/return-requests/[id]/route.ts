import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { findByEmailAny, getPatient, clinicalKey } from "@/lib/patients-store";
import { getDoctorSessionId } from "@/lib/auth";
import { getAlliedSessionId } from "@/lib/allied-session";
import { getNutritionistId } from "@/lib/nutrition-session";
import { getAttendantId } from "@/lib/attendant-session";
import { listLinksForAttendant } from "@/lib/attendants-store";
import { getReturnRequest, listReturnEvents, listReturnMessages, updateReturnRequest } from "@/lib/return-request-store";
import { addReturnEvent } from "@/lib/return-request-store";
import { closeReturnRequest } from "@/lib/return-request-flow";
import { STATUS_LABEL } from "@/lib/return-request-types";

async function canSee(req: Awaited<ReturnType<typeof getReturnRequest>>) {
  if (!req) return { ok: false as const, who: "" };
  const doctorId = await getDoctorSessionId();
  if (doctorId && req.professionalKind === "doctor" && req.professionalId === doctorId) return { ok: true as const, who: "professional" };
  const alliedId = await getAlliedSessionId();
  if (alliedId && req.professionalId === alliedId) return { ok: true as const, who: "professional" };
  const nutId = await getNutritionistId();
  if (nutId && req.professionalId === nutId) return { ok: true as const, who: "professional" };
  const email = await getPatientEmail();
  if (email) {
    const p = email.startsWith("pid:") ? await getPatient(email.slice(4)) : await findByEmailAny(email);
    const key = (p ? clinicalKey(p) : email).toLowerCase();
    const mail = (p?.email || (email.includes("@") ? email : "")).toLowerCase();
    if (
      req.patientKey.toLowerCase() === key ||
      req.patientKey.toLowerCase() === email.toLowerCase() ||
      (req.patientEmail || "").toLowerCase() === email.toLowerCase() ||
      (mail && (req.patientEmail || "").toLowerCase() === mail)
    ) {
      return { ok: true as const, who: "patient" };
    }
  }
  const attId = await getAttendantId();
  if (attId && req.professionalKind === "doctor") {
    const links = await listLinksForAttendant(attId);
    if (links.some((l) => l.doctorId === req.professionalId && l.active)) return { ok: true as const, who: "attendant" };
  }
  return { ok: false as const, who: "" };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getReturnRequest(id);
  const access = await canSee(row);
  if (!row || !access.ok) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  const [messages, events] = await Promise.all([listReturnMessages(id), listReturnEvents(id)]);
  return NextResponse.json({
    request: row,
    messages,
    events,
    statusLabel: STATUS_LABEL[row.status],
    you: access.who,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getReturnRequest(id);
  const access = await canSee(row);
  if (!row || !access.ok) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "cancel" && access.who === "patient") {
    if (!["pending_review", "awaiting_patient", "suggested_slot"].includes(row.status)) {
      return NextResponse.json({ error: "Esta solicitação não pode mais ser cancelada." }, { status: 400 });
    }
    const updated = await updateReturnRequest(id, { status: "cancelled", chatOpen: false, closedAt: new Date().toISOString() });
    await addReturnEvent(id, "paciente", "cancelada", "Paciente cancelou a solicitação.");
    return NextResponse.json({ ok: true, request: updated });
  }

  if (action === "close" && access.who === "professional") {
    const updated = await closeReturnRequest(id, row.professionalName);
    return NextResponse.json({ ok: true, request: updated });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
