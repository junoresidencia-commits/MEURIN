import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { addMembership, createClinic } from "../src/lib/platform-store";
import {
  createEncounter,
  financeInconsistencies,
  listFinanceEvents,
  listPayments,
  recordCheckIn,
  upsertFeeRule,
} from "../src/lib/clinic-finance-store";
import { addClosingAdjustment, createClosing, markClosingPaid, previewClosing } from "../src/lib/clinic-closing-store";
import { clinicExecutiveResumo } from "../src/lib/clinic-resumo";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const before = await collectIntegrityCounts();
  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos);
  const carlosId = carlos.id;
  const carlosHash = carlos.passwordHash;

  const clinicA = await createClinic({ name: "Financeiro Histórico A", city: "Salvador", status: "pilot" });
  const clinicB = await createClinic({ name: "Financeiro Histórico B", city: "Recife", status: "pilot" });
  await addMembership({ clinicId: clinicA.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await addMembership({ clinicId: clinicA.id, actorKind: "doctor", actorId: carlos.id, role: "MEDICO" });
  await addMembership({ clinicId: clinicB.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });

  await upsertFeeRule({
    clinicId: clinicA.id,
    doctorId: carlos.id,
    feeCents: 45000,
    clinicSharePercent: 20,
    reason: "Tabela inicial do piloto",
    actorKind: "doctor",
    actorId: carlos.id,
    actorEmail: carlos.email,
  });
  const createdEvents = await listFinanceEvents(clinicA.id);
  const createdRule = createdEvents.find((e) => e.kind === "fee_rule");
  assert.ok(createdRule);
  assert.equal(createdRule.beforeCents, null);
  assert.equal(createdRule.afterCents, 45000);
  assert.equal(createdRule.reason, "Tabela inicial do piloto");

  await upsertFeeRule({
    clinicId: clinicA.id,
    doctorId: carlos.id,
    feeCents: 50000,
    clinicSharePercent: 20,
    reason: "Reajuste combinado",
    actorKind: "doctor",
    actorId: carlos.id,
    actorEmail: carlos.email,
  });
  const updatedRule = (await listFinanceEvents(clinicA.id)).find((e) => e.kind === "fee_rule" && e.afterCents === 50000);
  assert.ok(updatedRule);
  assert.equal(updatedRule.beforeCents, 45000);
  assert.equal(updatedRule.reason, "Reajuste combinado");

  const previewNoEnc = await previewClosing({
    clinicId: clinicA.id,
    doctorId: carlos.id,
    periodFrom: `${new Date().getFullYear()}-01-01`,
    periodTo: `${new Date().getFullYear()}-12-31`,
  });
  assert.ok(previewNoEnc.warnings.some((w) => /Não há produção/.test(w)));

  const previewNoRule = await previewClosing({
    clinicId: clinicA.id,
    doctorId: "medico-sem-regra",
    periodFrom: `${new Date().getFullYear()}-01-01`,
    periodTo: `${new Date().getFullYear()}-12-31`,
  });
  assert.ok(previewNoRule.warnings.some((w) => /Nenhuma regra de honorário/.test(w)));

  const enc = await createEncounter({
    clinicId: clinicA.id,
    doctorId: carlos.id,
    patientKey: "historico.financeiro@meurim.local",
    patientName: "Paciente Histórico",
  });
  const first = await recordCheckIn({
    clinicId: clinicA.id,
    encounterId: enc.id,
    method: "pix",
    amountCents: 50000,
    recordedByKind: "doctor",
    recordedById: carlos.id,
  });
  assert.equal(first.duplicate, undefined);
  assert.equal(first.encounter.receivedCents, 50000);

  const second = await recordCheckIn({
    clinicId: clinicA.id,
    encounterId: enc.id,
    method: "pix",
    amountCents: 50000,
    recordedByKind: "doctor",
    recordedById: carlos.id,
  });
  assert.equal(second.duplicate, true);
  assert.equal(second.payment.id, first.payment.id);
  const pays = await listPayments(clinicA.id, enc.id);
  assert.equal(pays.length, 1, "duplo clique não cria segundo check-in");

  const checkinEvent = (await listFinanceEvents(clinicA.id)).find((e) => e.kind === "checkin");
  assert.ok(checkinEvent);
  assert.equal(checkinEvent.beforeCents, 0);
  assert.equal(checkinEvent.afterCents, 50000);

  const year = new Date().getFullYear();
  const preview = await previewClosing({
    clinicId: clinicA.id,
    doctorId: carlos.id,
    periodFrom: `${year}-01-01`,
    periodTo: `${year}-12-31`,
  });
  assert.equal(preview.encounterCount, 1);
  assert.ok(!preview.warnings.some((w) => /Nenhuma regra/.test(w)));

  const closing = await createClosing({
    clinicId: clinicA.id,
    doctorId: carlos.id,
    periodFrom: `${year}-01-01`,
    periodTo: `${year}-12-31`,
    createdBy: carlos.id,
  });
  assert.ok((await listFinanceEvents(clinicA.id)).some((e) => e.kind === "closing" && e.reason === closing.code));

  const paid = await markClosingPaid(closing.id, carlos.id, clinicA.id);
  assert.equal(paid.status, "paid");
  assert.ok((await listFinanceEvents(clinicA.id)).some((e) => e.kind === "payout" && e.reason === closing.code));

  await addClosingAdjustment({
    closingId: closing.id,
    clinicId: clinicA.id,
    kind: "credit",
    amountCents: 1000,
    reason: "Complemento combinado no fechamento",
    createdByKind: "doctor",
    createdById: carlos.id,
    createdByEmail: carlos.email,
  });
  assert.ok((await listFinanceEvents(clinicA.id)).some((e) => e.kind === "adjustment"));

  await upsertFeeRule({ clinicId: clinicB.id, doctorId: carlos.id, feeCents: 30000, clinicSharePercent: 10, reason: "Clínica B" });
  const eventsA = await listFinanceEvents(clinicA.id, 80);
  const eventsB = await listFinanceEvents(clinicB.id, 80);
  assert.ok(eventsA.every((e) => e.clinicId === clinicA.id));
  assert.ok(eventsB.every((e) => e.clinicId === clinicB.id));
  assert.ok(!eventsB.some((e) => e.reason === closing.code));

  const issues = await financeInconsistencies(clinicA.id);
  assert.equal(issues.length, 0);
  const resumo = await clinicExecutiveResumo(clinicA.id);
  assert.ok(Array.isArray(resumo.inconsistencies));
  assert.equal(resumo.inconsistencies.length, 0);

  const after = await readDb();
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.length, 0, dropped.join(", "));

  console.log("clinic-finance-history ok", {
    clinicA: clinicA.id,
    eventsA: eventsA.length,
    closing: closing.code,
    payments: pays.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
