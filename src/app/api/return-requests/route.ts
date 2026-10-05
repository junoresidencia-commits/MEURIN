import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { findByEmailAny, getPatient, clinicalKey } from "@/lib/patients-store";
import { getDoctorSessionId } from "@/lib/auth";
import { getAlliedSessionId } from "@/lib/allied-session";
import { getNutritionistId } from "@/lib/nutrition-session";
import { getDoctorById } from "@/lib/store";
import { getAlliedProfessional } from "@/lib/allied-store";
import { getNutritionist } from "@/lib/nutritionists-store";
import {
  isReturnProfessionalKind,
  daysBetween,
  habitualWindow,
  type LastVisitApprox,
} from "@/lib/return-request-types";
import { createReturnRequest, listReturnRequestsForPatient, listReturnRequestsForProfessional, listReturnRequestsForDoctors } from "@/lib/return-request-store";
import { getAttendantId } from "@/lib/attendant-session";
import { listLinksForAttendant } from "@/lib/attendants-store";
import { addReturnMessage } from "@/lib/return-request-store";
import { findLastVisit, loadPublicProfessional, parseApproxDate } from "@/lib/return-request-flow";
import { sendNotification } from "@/lib/notify";

async function patientProfile(subject: string) {
  const p = subject.startsWith("pid:") ? await getPatient(subject.slice(4)) : await findByEmailAny(subject);
  return {
    key: p ? clinicalKey(p) : subject.toLowerCase().trim(),
    name: p?.name || "Paciente",
    email: p?.email || (subject.includes("@") ? subject : null),
  };
}

async function professionalActor() {
  const doctorId = await getDoctorSessionId();
  if (doctorId) {
    const d = await getDoctorById(doctorId);
    return { kind: "doctor" as const, id: doctorId, name: d?.name || "Médico" };
  }
  const alliedId = await getAlliedSessionId();
  if (alliedId) {
    const p = await getAlliedProfessional(alliedId);
    if (p) return { kind: p.role as "psychology" | "nursing", id: p.id, name: p.name };
  }
  const nutId = await getNutritionistId();
  if (nutId) {
    const n = await getNutritionist(nutId);
    if (n) return { kind: "nutrition" as const, id: n.id, name: n.name };
  }
  return null;
}

export async function GET() {
  const email = await getPatientEmail();
  const actor = email ? null : await professionalActor();
  if (email) {
    const me = await patientProfile(email);
    const requests = await listReturnRequestsForPatient(me.key);
    const also = me.email && me.email !== me.key ? await listReturnRequestsForPatient(me.email) : [];
    const map = new Map(requests.concat(also).map((r) => [r.id, r]));
    return NextResponse.json({ requests: [...map.values()] });
  }
  if (actor) {
    const requests = await listReturnRequestsForProfessional(actor.kind, actor.id);
    return NextResponse.json({ requests });
  }
  const attId = await getAttendantId();
  if (attId) {
    const links = await listLinksForAttendant(attId);
    const doctorIds = links.filter((l) => l.active).map((l) => l.doctorId);
    const requests = (await listReturnRequestsForDoctors(doctorIds)).filter((r) => r.attendantInvited);
    return NextResponse.json({ requests });
  }
  return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
}

export async function POST(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Entre como paciente para solicitar um retorno." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isReturnProfessionalKind(body.professionalKind)) {
    return NextResponse.json({ error: "Profissional inválido." }, { status: 400 });
  }
  const pro = await loadPublicProfessional(body.professionalKind, String(body.professionalId || ""));
  if (!pro) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
  const start = String(body.slotStart || "");
  const end = String(body.slotEnd || "");
  if (!start || Number.isNaN(new Date(start).getTime())) {
    return NextResponse.json({ error: "Escolha um horário." }, { status: 400 });
  }
  const me = await patientProfile(subject);
  const registered = await findLastVisit({
    kind: pro.kind,
    professionalId: pro.id,
    patientEmail: me.email,
    patientKey: me.key,
  });
  const approxKind = (["date", "month_year", "unknown"].includes(String(body.lastVisitApprox)) ? body.lastVisitApprox : null) as LastVisitApprox | null;
  const reportedAt = !registered && body.alreadySeen === true
    ? parseApproxDate(String(body.lastVisitWhen || ""), approxKind || "unknown")
    : null;
  const lastVisitAt = registered?.at || reportedAt;
  const days = lastVisitAt ? daysBetween(lastVisitAt, start) : null;
  const window = habitualWindow(days);

  const created = await createReturnRequest({
    professionalKind: pro.kind,
    professionalId: pro.id,
    professionalName: pro.displayName,
    professionalSpecialty: pro.specialty,
    patientKey: me.key,
    patientName: me.name,
    patientEmail: me.email,
    requestedSlotStart: new Date(start).toISOString(),
    requestedSlotEnd: end && !Number.isNaN(new Date(end).getTime()) ? new Date(end).toISOString() : new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString(),
    status: "pending_review",
    lastVisitAt,
    lastVisitSource: registered ? "registered" : body.alreadySeen === true ? "patient_reported" : null,
    lastVisitLocation: body.lastVisitLocation ? String(body.lastVisitLocation).slice(0, 200) : null,
    lastVisitApprox: registered ? "date" : approxKind,
    daysSinceLast: days,
    withinHabitual: lastVisitAt ? window.within : null,
    patientNote: body.note ? String(body.note).slice(0, 2000) : null,
  });

  if (created.patientNote) {
    await addReturnMessage({
      requestId: created.id,
      authorRole: "patient",
      authorId: me.key,
      authorName: me.name,
      body: created.patientNote,
    });
  }
  await sendNotification({
    userId: pro.id,
    role: pro.kind === "doctor" ? "medico" : "paciente",
    type: "solicitacao_retorno",
    title: "Solicitação de retorno",
    body: `${me.name} solicitou um retorno. Confirme se este atendimento deve ser realizado como retorno.`,
    targetUrl: pro.kind === "doctor" ? `/medicos/solicitacoes/${created.id}` : `/${pro.kind === "nutrition" ? "nutricionista" : pro.kind === "psychology" ? "psicologo" : "enfermeiro"}/solicitacoes/${created.id}`,
    tag: `return-${created.id}`,
    relatedType: "return_request",
    relatedId: created.id,
  });

  return NextResponse.json({
    ok: true,
    request: created,
    reserved: false,
    notice: "Solicitação enviada. O horário só estará reservado após a confirmação do profissional.",
  }, { status: 201 });
}
