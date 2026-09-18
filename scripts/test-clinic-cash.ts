import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { createClinic, addMembership, updateMembershipPermissions } from "../src/lib/platform-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";
import {
  createEncounter,
  recordCheckIn,
  listEncounters,
  listFinanceEvents,
  productionSummary,
} from "../src/lib/clinic-finance-store";
import {
  attachIssuedNfse,
  cashFlow,
  closeCashDay,
  correctExpense,
  createExpense,
  createReceiptDoc,
  getExpense,
  listCashSessions,
  listExpenses,
  listFiscalDocs,
  operationalResult,
  requestNfseDoc,
} from "../src/lib/clinic-cash-store";
import { reaisPorExtenso } from "../src/lib/reais-extenso";
import { nfseConfigured } from "../src/lib/nfse-provider";
import { clinicCashPerm, type ClinicStaff } from "../src/lib/platform-access";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }
  const before = await collectIntegrityCounts();
  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos, "seed do Dr. Carlos permanece");

  assert.equal(reaisPorExtenso(4800), "quarenta e oito reais");
  assert.equal(reaisPorExtenso(45000), "quatrocentos e cinquenta reais");
  assert.equal(nfseConfigured(), false, "sem provedor, nao inventa NFS-e");

  const clinic = await createClinic({ name: "Clinica Caixa Teste", city: "Salvador" });
  const membership = await addMembership({
    clinicId: clinic.id,
    actorKind: "doctor",
    actorId: carlos.id,
    role: "ADMIN_CLINICA",
  });

  const staff = {
    kind: "attendant" as const,
    actorId: "att-1",
    email: "ludielle@meurim.com",
    name: "Ludielle",
    clinic,
    membership: { ...membership, actorKind: "attendant" as const, permissions: {} },
    isSuperAdmin: false,
    canAdmin: false,
    canCheckout: true,
  } satisfies ClinicStaff;
  assert.equal(clinicCashPerm(staff, "expense"), true);
  const blocked = { ...staff, membership: { ...staff.membership, permissions: { expense: false } } };
  assert.equal(clinicCashPerm(blocked, "expense"), false);
  await updateMembershipPermissions(membership.id, { expense: true, receipt: true });

  const enc = await createEncounter({
    clinicId: clinic.id,
    doctorId: carlos.id,
    patientKey: "joao.caixa@meurim.com",
    patientName: "Joao Silva",
  });
  const check = await recordCheckIn({
    clinicId: clinic.id,
    encounterId: enc.id,
    method: "cash",
    amountCents: 45000,
    recordedByKind: "attendant",
    recordedById: "att-1",
  });
  assert.equal(check.encounter.receivedCents, 45000);

  const expense = await createExpense({
    clinicId: clinic.id,
    amountCents: 4800,
    category: "material_medico",
    description: "Compra de algodao",
    method: "dinheiro",
    origin: "caixa_fisico",
    responsibleName: "Ludielle",
    locationLabel: clinic.name,
    notes: "Retirado do caixa da clinica",
    recordedByKind: "attendant",
    recordedById: "att-1",
    recordedByEmail: "ludielle@meurim.com",
  });
  assert.equal(expense.amountCents, 4800);
  assert.equal(expense.voidedAt, null);

  const today = new Date().toISOString().slice(0, 10);
  const flow = await cashFlow(clinic.id, { from: today, to: today });
  assert.equal(flow.inCents, 45000);
  assert.equal(flow.outCents, 4800);
  assert.equal(flow.closingCents, 40200);
  assert.equal(flow.byMethod.dinheiro.inCents, 45000);
  assert.equal(flow.byMethod.dinheiro.outCents, 4800);

  await assert.rejects(
    () => closeCashDay({ clinicId: clinic.id, countedCents: 40000 }),
    /Justifique/
  );
  const session = await closeCashDay({
    clinicId: clinic.id,
    countedCents: 40000,
    justification: "Faltaram 2 reais no envelope do caixa.",
    closedByKind: "attendant",
    closedById: "att-1",
    closedByName: "Ludielle",
    closedByEmail: "ludielle@meurim.com",
  });
  assert.equal(session.expectedCents, 40200);
  assert.equal(session.countedCents, 40000);
  assert.equal(session.differenceCents, -200);
  await assert.rejects(
    () => closeCashDay({ clinicId: clinic.id, countedCents: 40000, justification: "segunda vez" }),
    /já foi fechado/
  );
  assert.equal((await listCashSessions(clinic.id)).length, 1);

  const corrected = await correctExpense({
    clinicId: clinic.id,
    expenseId: expense.id,
    amountCents: 5000,
    reason: "Valor conferido na nota fiscal da loja.",
    actorKind: "attendant",
    actorId: "att-1",
    actorEmail: "ludielle@meurim.com",
  });
  const old = await getExpense(expense.id);
  assert.ok(old?.voidedAt, "lancamento original permanece, so anulado");
  assert.equal(old?.amountCents, 4800);
  assert.equal(corrected.next.amountCents, 5000);
  assert.equal(corrected.next.correctedFromId, expense.id);
  assert.equal((await listExpenses(clinic.id)).length >= 2, true);

  const recibo = await createReceiptDoc({
    clinicId: clinic.id,
    clinicName: clinic.name,
    encounterId: enc.id,
    patientKey: "joao.caixa@meurim.com",
    amountCents: 45000,
    serviceLabel: "Consulta",
    paymentMethod: "Dinheiro",
    patientName: "Joao Silva",
    patientCpf: "123.456.789-00",
    doctorId: carlos.id,
    doctorName: carlos.name,
    doctorCrm: carlos.crm,
    actor: { kind: "doctor", id: carlos.id, email: carlos.email },
  });
  assert.equal(recibo.kind, "recibo");
  assert.equal(recibo.status, "issued");
  assert.ok(recibo.pdfPath);
  assert.match(recibo.number || "", /^REC-/);

  const nf = await requestNfseDoc({
    clinicId: clinic.id,
    clinicName: clinic.name,
    encounterId: enc.id,
    patientKey: "joao.caixa@meurim.com",
    amountCents: 45000,
    patientName: "Joao Silva",
    patientCpf: "123.456.789-00",
    doctorName: carlos.name,
    actor: { kind: "attendant", id: "att-1", email: "ludielle@meurim.com" },
  });
  assert.equal(nf.queued, true);
  assert.equal(nf.autoIssued, false);
  assert.equal(nf.doc.status, "pending");
  assert.equal(nf.doc.kind, "nfse");

  const attached = await attachIssuedNfse({
    clinicId: clinic.id,
    docId: nf.doc.id,
    number: "NFSE-1001",
    pdf: { name: "nfse.pdf", type: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") },
    actor: { kind: "attendant", id: "att-1" },
  });
  assert.equal(attached.status, "issued");
  assert.equal(attached.number, "NFSE-1001");
  assert.ok(attached.pdfPath);

  const docs = await listFiscalDocs(clinic.id);
  assert.ok(docs.some((d) => d.kind === "recibo"));
  assert.ok(docs.some((d) => d.kind === "nfse" && d.status === "issued"));

  const result = await operationalResult(clinic.id, today, today);
  assert.equal(result.receitaBrutaCents, 45000);
  assert.ok(result.despesaTotalCents >= 5000);
  assert.equal(result.clinicShareCents, productionSummary(await listEncounters(clinic.id)).clinicShareCents);

  const events = await listFinanceEvents(clinic.id, 80);
  assert.ok(events.some((e) => e.kind === "expense"));
  assert.ok(events.some((e) => e.kind === "cash_close"));
  assert.ok(events.some((e) => e.kind === "receipt"));
  assert.ok(events.some((e) => e.kind === "nfse_request"));
  assert.ok(events.some((e) => e.kind === "nfse_attach"));
  assert.ok(events.some((e) => e.kind === "checkin"));

  const after = await collectIntegrityCounts();
  const dropped = countsDropped(before, after);
  assert.equal(dropped.length, 0, `contagem clinica diminuiu: ${dropped.join(", ")}`);
  assert.ok(after.doctors >= before.doctors);
  assert.ok(after.patients >= before.patients);
  assert.ok(after.bookings >= before.bookings);

  console.log("clinic-cash ok", {
    clinicId: clinic.id,
    expenseId: expense.id,
    sessionId: session.id,
    recibo: recibo.number,
    nfse: attached.number,
    flowOut: flow.outCents,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
