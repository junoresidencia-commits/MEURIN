import "server-only";
import { v4 as uuid } from "uuid";
import { getDoctorById, listBookingsForDoctor, updateDb } from "./store";
import { getNutritionist } from "./nutritionists-store";
import { listAppointmentsForNutritionist } from "./nutrition-appointments-store";
import { getAlliedProfessional } from "./allied-store";
import { findPatientByClinicalKey } from "./patients-store";
import { generateAvailableSlots } from "./scheduling";
import { sendNotification, patientKey, fmtDateTime } from "./notify";
import {
  DEADLINE_REFUSAL_MESSAGE,
  ASK_INFO_MESSAGE,
  RETURN_HABITUAL_DAYS,
  daysBetween,
  habitualWindow,
  titlePrefix,
  type LastVisitApprox,
  type ReturnDecision,
  type ReturnProfessionalKind,
  type ReturnRequest,
} from "./return-request-types";
import {
  addReturnEvent,
  addReturnMessage,
  getReturnRequest,
  updateReturnRequest,
} from "./return-request-store";
import type { Booking, Modality } from "./types";

export type PublicProfessional = {
  kind: ReturnProfessionalKind;
  id: string;
  name: string;
  displayName: string;
  specialty: string;
  photoUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  clinic?: string | null;
  consultationPriceCents: number;
  returnPriceCents: number;
};

export async function loadPublicProfessional(kind: ReturnProfessionalKind, id: string): Promise<PublicProfessional | null> {
  if (kind === "doctor") {
    const d = await getDoctorById(id);
    if (!d || (d.status && d.status !== "approved")) return null;
    return {
      kind, id: d.id, name: d.name, displayName: titlePrefix(d.name, "doctor"),
      specialty: d.specialty || "Nefrologia", photoUrl: d.photoUrl, bio: d.bio,
      city: d.clinic, clinic: d.clinic,
      consultationPriceCents: d.consultationPriceCents || 0,
      returnPriceCents: 0,
    };
  }
  if (kind === "nutrition") {
    const n = await getNutritionist(id);
    if (!n || n.status !== "active") return null;
    return {
      kind, id: n.id, name: n.name, displayName: n.name,
      specialty: n.specialty || "Nutrição", photoUrl: n.photoUrl, bio: n.bio,
      city: n.city, consultationPriceCents: n.consultationPriceCents ?? 0,
      returnPriceCents: n.returnPriceCents ?? 0,
    };
  }
  const p = await getAlliedProfessional(id);
  if (!p || p.status !== "active") return null;
  if (kind === "psychology" && p.role !== "psychology") return null;
  if (kind === "nursing" && p.role !== "nursing") return null;
  return {
    kind, id: p.id, name: p.name, displayName: p.name,
    specialty: p.specialty || (kind === "psychology" ? "Psicologia" : "Enfermagem"),
    photoUrl: p.photoUrl, bio: p.bio, city: p.city,
    consultationPriceCents: p.consultationPriceCents ?? 0,
    returnPriceCents: p.returnPriceCents ?? 0,
  };
}

export async function findLastVisit(opts: {
  kind: ReturnProfessionalKind;
  professionalId: string;
  patientEmail?: string | null;
  patientKey: string;
}): Promise<{ at: string; source: "registered" } | null> {
  const patient = await findPatientByClinicalKey(opts.patientEmail || opts.patientKey).catch(() => null);
  const keys = new Set(
    [opts.patientEmail, opts.patientKey, patient?.email, patient ? `pid:${patient.id}` : ""]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase().trim())
  );
  if (opts.kind === "doctor") {
    const mine = await listBookingsForDoctor(opts.professionalId);
    const done = mine
      .filter((b) => ["paid", "confirmed", "completed"].includes(b.status) || b.stage === "realizada" || b.stage === "confirmada")
      .filter((b) => keys.has((b.patientEmail || "").toLowerCase().trim()))
      .sort((a, b) => new Date(b.slotStart).getTime() - new Date(a.slotStart).getTime());
    if (done[0]) return { at: new Date(done[0].slotStart).toISOString(), source: "registered" };
  }
  if (opts.kind === "nutrition") {
    const list = await listAppointmentsForNutritionist(opts.professionalId);
    const done = list
      .filter((a) => a.status === "confirmada" || a.status === "realizada")
      .filter((a) => keys.has(a.patientKey.toLowerCase()))
      .sort((a, b) => String(b.slotStart || b.createdAt).localeCompare(String(a.slotStart || a.createdAt)));
    const at = done[0] ? String(done[0].slotStart || done[0].createdAt) : "";
    if (at) return { at: new Date(at).toISOString(), source: "registered" };
  }
  return null;
}

export async function listReturnSlots(kind: ReturnProfessionalKind, id: string) {
  if (kind !== "doctor") return [];
  const doctor = await getDoctorById(id);
  if (!doctor) return [];
  const mine = await listBookingsForDoctor(id);
  const booked = mine
    .filter((b) => ["pending_payment", "paid", "confirmed"].includes(b.status))
    .map((b) => new Date(b.slotStart).toISOString());
  const slots = generateAvailableSlots(doctor, { excludeStarts: new Set(booked) });
  return slots.filter((s) => !s.visitKind || s.visitKind === "retorno" || s.visitKind === "ambos");
}

export async function listConsultSlots(kind: ReturnProfessionalKind, id: string) {
  if (kind !== "doctor") return [];
  const doctor = await getDoctorById(id);
  if (!doctor) return [];
  const mine = await listBookingsForDoctor(id);
  const booked = mine
    .filter((b) => ["pending_payment", "paid", "confirmed"].includes(b.status))
    .map((b) => new Date(b.slotStart).toISOString());
  const slots = generateAvailableSlots(doctor, { excludeStarts: new Set(booked) });
  return slots.filter((s) => !s.visitKind || s.visitKind === "consulta" || s.visitKind === "ambos");
}

export function decorateLastVisit(req: Pick<ReturnRequest, "lastVisitAt" | "daysSinceLast" | "requestedSlotStart" | "lastVisitSource">) {
  const days = req.daysSinceLast ?? (req.lastVisitAt ? daysBetween(req.lastVisitAt, req.requestedSlotStart) : null);
  const window = habitualWindow(days);
  return { days, ...window, source: req.lastVisitSource || null };
}

async function createConfirmedBooking(req: ReturnRequest, opts: { priceCents: number; courtesy?: "retorno"; modality?: Modality }): Promise<string> {
  const booking: Booking = {
    id: uuid(),
    doctorId: req.professionalId,
    patientName: req.patientName,
    patientEmail: (req.patientEmail || req.patientKey).toLowerCase(),
    patientPhone: "",
    patientCity: "",
    careReason: "acompanhamento",
    slotStart: req.suggestedSlotStart || req.requestedSlotStart,
    slotEnd: req.suggestedSlotEnd || req.requestedSlotEnd,
    priceCents: opts.priceCents,
    paymentMethod: "pix",
    status: opts.priceCents > 0 ? "pending_payment" : "confirmed",
    meetingRoomId: uuid(),
    confirmationEmailSent: false,
    createdAt: new Date().toISOString(),
    modality: opts.modality || "teleconsulta",
    courtesyKind: opts.courtesy,
    stage: opts.priceCents > 0 ? "aguardando_confirmacao" : "confirmada",
    events: [
      {
        at: new Date().toISOString(),
        actor: "medico",
        type: opts.courtesy ? "retorno_confirmado" : "convertida_nova_consulta",
        detail: opts.courtesy
          ? "Profissional confirmou a solicitação como retorno."
          : "Profissional classificou o atendimento como nova consulta.",
      },
    ],
  };
  await updateDb((current) => ({ ...current, bookings: [...current.bookings, booking] }));
  return booking.id;
}

export async function applyProfessionalDecision(
  requestId: string,
  actor: { id: string; name: string; role: "professional" | "attendant" },
  input: {
    decision: ReturnDecision;
    message?: string;
    slotStart?: string;
    slotEnd?: string;
    refusalReason?: string;
  }
): Promise<ReturnRequest> {
  const req = await getReturnRequest(requestId);
  if (!req) throw new Error("Solicitação não encontrada.");
  if (["cancelled", "closed", "refused", "refused_deadline", "confirmed_return", "confirmed_new"].includes(req.status) && input.decision !== "invite_attendant") {
    throw new Error("Esta solicitação já foi encerrada.");
  }

  const now = new Date().toISOString();
  const over30 = req.daysSinceLast != null && req.daysSinceLast > RETURN_HABITUAL_DAYS;
  const pro = await loadPublicProfessional(req.professionalKind, req.professionalId);
  const returnPrice = pro?.returnPriceCents ?? 0;
  const consultPrice = pro?.consultationPriceCents ?? 0;

  if (input.decision === "confirm_return" || input.decision === "confirm_return_exception") {
    if (over30 && input.decision === "confirm_return") {
      // still allowed — treat as exception if over 30
    }
    const exceptional = over30;
    let bookingId: string | null = null;
    if (req.professionalKind === "doctor") {
      bookingId = await createConfirmedBooking(req, {
        priceCents: returnPrice,
        courtesy: returnPrice === 0 ? "retorno" : undefined,
      });
    }
    const updated = await updateReturnRequest(requestId, {
      status: returnPrice > 0 ? "awaiting_payment" : "confirmed_return",
      decision: exceptional ? "confirm_return_exception" : "confirm_return",
      decisionBy: actor.id,
      decisionAt: now,
      exceptionalAfter30: exceptional,
      bookingId,
      priceCents: returnPrice,
      paymentStatus: returnPrice > 0 ? "pending" : "free",
    });
    await addReturnEvent(
      requestId,
      actor.name,
      exceptional ? "retorno_excepcional" : "retorno_confirmado",
      exceptional
        ? "Retorno autorizado manualmente pelo profissional apesar do prazo habitual de 30 dias ter sido ultrapassado."
        : "Profissional confirmou o atendimento como retorno. Horário reservado."
    );
    await addReturnMessage({
      requestId, authorRole: "system", authorId: "sistema", authorName: "Meu Rim",
      body: returnPrice > 0
        ? "O profissional confirmou o retorno. Há um valor de retorno a pagar conforme a política configurada."
        : "Retorno confirmado pelo profissional. O horário foi reservado.",
    });
    await sendNotification({
      userId: patientKey(req.patientEmail || req.patientKey),
      role: "paciente",
      type: "retorno_confirmado",
      title: "Retorno confirmado",
      body: `Seu retorno com ${req.professionalName} foi confirmado.`,
      targetUrl: `/paciente/retorno/${requestId}`,
      tag: `return-${requestId}`,
      relatedType: "return_request",
      relatedId: requestId,
    });
    return updated!;
  }

  if (input.decision === "convert_new") {
    const updated = await updateReturnRequest(requestId, {
      status: "awaiting_payment",
      decision: "convert_new",
      decisionBy: actor.id,
      decisionAt: now,
      convertedToNew: true,
      priceCents: consultPrice,
      paymentStatus: consultPrice > 0 ? "pending" : "free",
    });
    await addReturnEvent(requestId, actor.name, "convertida_nova_consulta", "Profissional avaliou que este atendimento deverá ser uma nova consulta.");
    await addReturnMessage({
      requestId, authorRole: "system", authorId: "sistema", authorName: "Meu Rim",
      body: `O profissional avaliou que este atendimento deverá ser realizado como uma nova consulta.${consultPrice > 0 ? ` Valor: R$ ${(consultPrice / 100).toFixed(2).replace(".", ",")}.` : ""}`,
    });
    await sendNotification({
      userId: patientKey(req.patientEmail || req.patientKey),
      role: "paciente",
      type: "retorno_convertido",
      title: "Alteração do tipo de atendimento",
      body: "O profissional avaliou que este atendimento deverá ser uma nova consulta.",
      targetUrl: `/paciente/retorno/${requestId}`,
      tag: `return-${requestId}`,
      relatedType: "return_request",
      relatedId: requestId,
    });
    return updated!;
  }

  if (input.decision === "suggest_slot") {
    if (!input.slotStart || !input.slotEnd) throw new Error("Informe o horário sugerido.");
    const updated = await updateReturnRequest(requestId, {
      status: "suggested_slot",
      decision: "suggest_slot",
      decisionBy: actor.id,
      decisionAt: now,
      suggestedSlotStart: new Date(input.slotStart).toISOString(),
      suggestedSlotEnd: new Date(input.slotEnd).toISOString(),
    });
    await addReturnEvent(requestId, actor.name, "horario_sugerido", `Profissional sugeriu ${new Date(input.slotStart).toLocaleString("pt-BR")}.`);
    await addReturnMessage({
      requestId, authorRole: "professional", authorId: actor.id, authorName: actor.name,
      body: input.message || `Sugiro outro horário: ${fmtDateTime(input.slotStart)}.`,
    });
    await sendNotification({
      userId: patientKey(req.patientEmail || req.patientKey),
      role: "paciente",
      type: "retorno_horario",
      title: "O profissional sugeriu outro horário",
      body: fmtDateTime(input.slotStart),
      targetUrl: `/paciente/retorno/${requestId}`,
      tag: `return-${requestId}`,
      relatedType: "return_request",
      relatedId: requestId,
    });
    return updated!;
  }

  if (input.decision === "ask_info") {
    const body = input.message?.trim() || ASK_INFO_MESSAGE;
    const updated = await updateReturnRequest(requestId, {
      status: "awaiting_patient",
      decision: "ask_info",
      decisionBy: actor.id,
      decisionAt: now,
    });
    await addReturnEvent(requestId, actor.name, "pediu_informacoes", "Profissional pediu informações no chat.");
    await addReturnMessage({
      requestId, authorRole: "professional", authorId: actor.id, authorName: actor.name, body,
    });
    await sendNotification({
      userId: patientKey(req.patientEmail || req.patientKey),
      role: "paciente",
      type: "retorno_info",
      title: "O profissional pediu informações",
      body: "Responda no chat da solicitação de retorno.",
      targetUrl: `/paciente/retorno/${requestId}`,
      tag: `return-${requestId}`,
      relatedType: "return_request",
      relatedId: requestId,
    });
    return updated!;
  }

  if (input.decision === "invite_attendant") {
    const updated = await updateReturnRequest(requestId, { attendantInvited: true });
    await addReturnEvent(requestId, actor.name, "atendente", "Profissional encaminhou a solicitação para a atendente.");
    await addReturnMessage({
      requestId, authorRole: "professional", authorId: actor.id, authorName: actor.name,
      body: input.message || "Encaminhei esta solicitação para a atendente concluir o agendamento.",
    });
    return updated!;
  }

  if (input.decision === "refuse_deadline" || (input.decision === "refuse" && over30 && (input.refusalReason === "prazo" || !input.refusalReason))) {
    const message = (input.message || DEADLINE_REFUSAL_MESSAGE).trim();
    const updated = await updateReturnRequest(requestId, {
      status: "refused_deadline",
      decision: "refuse_deadline",
      decisionBy: actor.id,
      decisionAt: now,
      refusalReason: "Prazo de retorno ultrapassado",
      autoMessage: message,
      chatOpen: true,
    });
    await addReturnEvent(requestId, actor.name, "recusa_prazo", "Recusa automática por prazo de retorno ultrapassado.");
    await addReturnMessage({
      requestId, authorRole: "system", authorId: "sistema", authorName: "Meu Rim", body: message,
    });
    await sendNotification({
      userId: patientKey(req.patientEmail || req.patientKey),
      role: "paciente",
      type: "retorno_recusado_prazo",
      title: "Retorno não aprovado — prazo de 30 dias ultrapassado",
      body: "Para continuar o acompanhamento, será necessário realizar uma nova consulta.",
      targetUrl: `/paciente/retorno/${requestId}`,
      tag: `return-${requestId}`,
      relatedType: "return_request",
      relatedId: requestId,
    });
    return updated!;
  }

  const reason = input.refusalReason || input.message || "Solicitação não aprovada.";
  const updated = await updateReturnRequest(requestId, {
    status: "refused",
    decision: "refuse",
    decisionBy: actor.id,
    decisionAt: now,
    refusalReason: reason,
    autoMessage: input.message || reason,
  });
  await addReturnEvent(requestId, actor.name, "recusada", reason);
  await addReturnMessage({
    requestId, authorRole: "professional", authorId: actor.id, authorName: actor.name,
    body: input.message || reason,
  });
  await sendNotification({
    userId: patientKey(req.patientEmail || req.patientKey),
    role: "paciente",
    type: "retorno_recusado",
    title: "Solicitação recusada",
    body: "A solicitação de retorno não foi aprovada.",
    targetUrl: `/paciente/retorno/${requestId}`,
    tag: `return-${requestId}`,
    relatedType: "return_request",
    relatedId: requestId,
  });
  return updated!;
}

export async function patientAcceptSuggestedSlot(requestId: string): Promise<ReturnRequest> {
  const req = await getReturnRequest(requestId);
  if (!req || req.status !== "suggested_slot" || !req.suggestedSlotStart) {
    throw new Error("Não há horário sugerido para aceitar.");
  }
  const updated = await updateReturnRequest(requestId, {
    requestedSlotStart: req.suggestedSlotStart,
    requestedSlotEnd: req.suggestedSlotEnd || req.suggestedSlotStart,
    status: "pending_review",
  });
  await addReturnEvent(requestId, "paciente", "aceitou_horario", "Paciente aceitou o horário sugerido. Aguardando confirmação do profissional.");
  await addReturnMessage({
    requestId, authorRole: "patient", authorId: req.patientKey, authorName: req.patientName,
    body: "Aceitei o horário sugerido.",
  });
  return updated!;
}

export async function patientConfirmConvertedConsult(requestId: string): Promise<ReturnRequest> {
  const req = await getReturnRequest(requestId);
  if (!req || req.status !== "awaiting_payment") throw new Error("Não há nova consulta pendente nesta solicitação.");
  let bookingId = req.bookingId;
  if (req.professionalKind === "doctor" && !bookingId) {
    bookingId = await createConfirmedBooking(req, { priceCents: req.priceCents || 0 });
  }
  const paid = !req.priceCents || req.priceCents <= 0;
  const updated = await updateReturnRequest(requestId, {
    status: paid ? "confirmed_new" : "awaiting_payment",
    bookingId,
    paymentStatus: paid ? "free" : "pending",
  });
  await addReturnEvent(requestId, "paciente", "confirmou_nova_consulta", "Paciente confirmou a nova consulta.");
  return updated!;
}

export async function closeReturnRequest(requestId: string, actorName: string): Promise<ReturnRequest> {
  const updated = await updateReturnRequest(requestId, {
    status: "closed",
    chatOpen: false,
    closedAt: new Date().toISOString(),
  });
  await addReturnEvent(requestId, actorName, "encerrado", "Atendimento concluído. O chat foi arquivado.");
  await addReturnMessage({
    requestId, authorRole: "system", authorId: "sistema", authorName: "Meu Rim",
    body: "Atendimento concluído. O chat foi arquivado. Para uma nova demanda, abra um novo atendimento.",
  });
  return updated!;
}

export function parseApproxDate(value: string, kind: LastVisitApprox): string | null {
  if (kind === "unknown" || !value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  if (kind === "month_year") {
    const m = value.match(/^(\d{4})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 15).toISOString();
  }
  return null;
}
