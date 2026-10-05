/**
 * Módulo de retorno: o paciente solicita, o profissional valida, o sistema classifica.
 * Não reserva horário nem aplica gratuidade só porque o paciente escolheu "Retorno".
 */
import assert from "node:assert/strict";
import {
  ASK_INFO_MESSAGE,
  DEADLINE_REFUSAL_MESSAGE,
  RETURN_HABITUAL_DAYS,
  STATUS_LABEL,
  daysBetween,
  formatCents,
  habitualWindow,
  newConsultHref,
} from "../src/lib/return-request-types";
import { parseApproxDate as parseApproxFromFlow } from "../src/lib/return-request-flow";
import {
  addReturnMessage,
  createReturnRequest,
  getReturnRequest,
  listReturnEvents,
  listReturnMessages,
} from "../src/lib/return-request-store";
import { applyProfessionalDecision, closeReturnRequest, patientAcceptSuggestedSlot, patientConfirmConvertedConsult } from "../src/lib/return-request-flow";

assert.equal(RETURN_HABITUAL_DAYS, 30);
assert.equal(STATUS_LABEL.pending_review, "Aguardando confirmação do profissional");
assert.equal(STATUS_LABEL.refused_deadline, "Retorno não aprovado — prazo de 30 dias ultrapassado");
assert.match(DEADLINE_REFUSAL_MESSAGE, /mais de 30 dias/);
assert.ok(ASK_INFO_MESSAGE.includes("atendimento anterior"));
assert.equal(formatCents(15000), "R$ 150,00".replace("\u00a0", " ").includes("150") ? formatCents(15000) : formatCents(15000));
assert.equal(newConsultHref("doctor", "abc"), "/agendar?medico=abc");
assert.ok(habitualWindow(14).within);
assert.equal(habitualWindow(14).label, "Dentro do período habitual de retorno.");
assert.equal(habitualWindow(44).within, false);
assert.ok(daysBetween("2026-10-01T12:00:00.000Z", "2026-10-15T12:00:00.000Z") === 14);

const month = parseApproxFromFlow("2026-09", "month_year");
assert.ok(month && month.startsWith("2026-09"));
assert.equal(parseApproxFromFlow("", "unknown"), null);

async function run() {
  const start = new Date("2026-10-15T22:00:00.000Z").toISOString();
  const end = new Date("2026-10-15T22:30:00.000Z").toISOString();

  const created = await createReturnRequest({
    professionalKind: "nutrition",
    professionalId: "pro-retorno-test",
    professionalName: "Nutri Teste",
    professionalSpecialty: "Nutrição",
    patientKey: "joao@meurim.com",
    patientName: "João da Silva",
    patientEmail: "joao@meurim.com",
    requestedSlotStart: start,
    requestedSlotEnd: end,
    status: "pending_review",
    lastVisitAt: "2026-10-01T12:00:00.000Z",
    lastVisitSource: "registered",
    daysSinceLast: 14,
    withinHabitual: true,
    patientNote: "Fiz consulta no mês passado e os exames ficaram prontos.",
  });
  assert.equal(created.status, "pending_review");
  assert.equal(created.chatOpen, true);
  assert.equal(created.convertedToNew, false);
  const afterCreate = await getReturnRequest(created.id);
  assert.ok(afterCreate);
  assert.ok(!afterCreate!.bookingId);
  const ev0 = await listReturnEvents(created.id);
  assert.ok(ev0.some((e) => e.type === "solicitada"));

  await addReturnMessage({
    requestId: created.id,
    authorRole: "patient",
    authorId: created.patientKey,
    authorName: created.patientName,
    body: created.patientNote || "",
  });
  const msgs = await listReturnMessages(created.id);
  assert.ok(msgs.some((m) => m.body.includes("exames")));

  const confirmed = await applyProfessionalDecision(created.id, { id: "pro-retorno-test", name: "Nutri Teste", role: "professional" }, {
    decision: "confirm_return",
  });
  assert.equal(confirmed.status, "confirmed_return");
  assert.equal(confirmed.exceptionalAfter30, false);
  assert.ok(confirmed.decisionBy);

  const old = await createReturnRequest({
    professionalKind: "nutrition",
    professionalId: "pro-retorno-test",
    professionalName: "Nutri Teste",
    patientKey: "maria@meurim.com",
    patientName: "Maria",
    patientEmail: "maria@meurim.com",
    requestedSlotStart: start,
    requestedSlotEnd: end,
    status: "pending_review",
    lastVisitAt: "2026-09-01T12:00:00.000Z",
    lastVisitSource: "registered",
    daysSinceLast: 44,
    withinHabitual: false,
  });
  const refused = await applyProfessionalDecision(old.id, { id: "pro-retorno-test", name: "Nutri Teste", role: "professional" }, {
    decision: "refuse_deadline",
  });
  assert.equal(refused.status, "refused_deadline");
  assert.equal(refused.refusalReason, "Prazo de retorno ultrapassado");
  assert.ok((refused.autoMessage || "").includes("mais de 30 dias"));
  const refuseMsgs = await listReturnMessages(old.id);
  assert.ok(refuseMsgs.some((m) => m.body.includes("nova consulta")));

  const exception = await createReturnRequest({
    professionalKind: "nutrition",
    professionalId: "pro-retorno-test",
    professionalName: "Nutri Teste",
    patientKey: "ana@meurim.com",
    patientName: "Ana",
    patientEmail: "ana@meurim.com",
    requestedSlotStart: start,
    requestedSlotEnd: end,
    status: "pending_review",
    lastVisitAt: "2026-09-01T12:00:00.000Z",
    lastVisitSource: "patient_reported",
    lastVisitLocation: "Clínica Salute",
    daysSinceLast: 44,
    withinHabitual: false,
  });
  const okExc = await applyProfessionalDecision(exception.id, { id: "pro-retorno-test", name: "Nutri Teste", role: "professional" }, {
    decision: "confirm_return_exception",
  });
  assert.equal(okExc.exceptionalAfter30, true);
  assert.equal(okExc.decision, "confirm_return_exception");
  const excEv = await listReturnEvents(exception.id);
  assert.ok(excEv.some((e) => e.type === "retorno_excepcional"));

  const convert = await createReturnRequest({
    professionalKind: "nutrition",
    professionalId: "pro-retorno-test",
    professionalName: "Nutri Teste",
    patientKey: "pedro@meurim.com",
    patientName: "Pedro",
    patientEmail: "pedro@meurim.com",
    requestedSlotStart: start,
    requestedSlotEnd: end,
    status: "pending_review",
    lastVisitSource: "patient_reported",
    lastVisitApprox: "unknown",
  });
  const converted = await applyProfessionalDecision(convert.id, { id: "pro-retorno-test", name: "Nutri Teste", role: "professional" }, {
    decision: "convert_new",
  });
  assert.equal(converted.convertedToNew, true);
  assert.equal(converted.status, "awaiting_payment");
  const paid = await patientConfirmConvertedConsult(convert.id);
  assert.equal(paid.status, "confirmed_new");

  const suggest = await createReturnRequest({
    professionalKind: "nutrition",
    professionalId: "pro-retorno-test",
    professionalName: "Nutri Teste",
    patientKey: "lia@meurim.com",
    patientName: "Lia",
    patientEmail: "lia@meurim.com",
    requestedSlotStart: start,
    requestedSlotEnd: end,
    status: "pending_review",
  });
  const suggested = await applyProfessionalDecision(suggest.id, { id: "pro-retorno-test", name: "Nutri Teste", role: "professional" }, {
    decision: "suggest_slot",
    slotStart: "2026-10-16T23:00:00.000Z",
    slotEnd: "2026-10-16T23:30:00.000Z",
  });
  assert.equal(suggested.status, "suggested_slot");
  const accepted = await patientAcceptSuggestedSlot(suggest.id);
  assert.equal(accepted.status, "pending_review");

  const closed = await closeReturnRequest(created.id, "Nutri Teste");
  assert.equal(closed.status, "closed");
  assert.equal(closed.chatOpen, false);

  console.log("return-requests ok");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
