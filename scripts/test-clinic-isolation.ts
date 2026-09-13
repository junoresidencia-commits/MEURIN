import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { addMembership, createClinic, listAudit, updateClinicStatus } from "../src/lib/platform-store";
import { createEncounter, listEncounters, listFinanceEvents, recordCheckIn, upsertFeeRule } from "../src/lib/clinic-finance-store";
import { createClosing, markClosingPaid } from "../src/lib/clinic-closing-store";
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

  const clinicA = await createClinic({ name: "Clínica Teste A", city: "Salvador", status: "pilot" });
  const clinicB = await createClinic({ name: "Clínica Teste B", city: "Recife", status: "pilot" });
  assert.equal(clinicA.status, "pilot");
  assert.equal(clinicB.status, "pilot");

  await addMembership({ clinicId: clinicA.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await addMembership({ clinicId: clinicB.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await upsertFeeRule({ clinicId: clinicA.id, doctorId: carlos.id, feeCents: 45000, clinicSharePercent: 30 });
  await upsertFeeRule({ clinicId: clinicB.id, doctorId: carlos.id, feeCents: 30000, clinicSharePercent: 10 });

  const encA = await createEncounter({
    clinicId: clinicA.id,
    doctorId: carlos.id,
    patientKey: "isolamento.a@meurim.local",
    patientName: "Paciente A",
  });
  const encB = await createEncounter({
    clinicId: clinicB.id,
    doctorId: carlos.id,
    patientKey: "isolamento.b@meurim.local",
    patientName: "Paciente B",
  });

  const listA = await listEncounters(clinicA.id);
  const listB = await listEncounters(clinicB.id);
  assert.ok(listA.some((e) => e.id === encA.id));
  assert.ok(!listA.some((e) => e.id === encB.id), "clínica A não lista atendimento da B");
  assert.ok(listB.some((e) => e.id === encB.id));
  assert.ok(!listB.some((e) => e.id === encA.id), "clínica B não lista atendimento da A");

  await assert.rejects(
    () => recordCheckIn({ clinicId: clinicA.id, encounterId: encB.id, method: "pix", amountCents: 30000 }),
    /não encontrado nesta clínica/
  );

  await recordCheckIn({ clinicId: clinicA.id, encounterId: encA.id, method: "pix", amountCents: 45000 });
  await recordCheckIn({ clinicId: clinicB.id, encounterId: encB.id, method: "pix", amountCents: 30000 });

  const year = new Date().getFullYear();
  const closingB = await createClosing({
    clinicId: clinicB.id,
    doctorId: carlos.id,
    periodFrom: `${year}-01-01`,
    periodTo: `${year}-12-31`,
    createdBy: carlos.id,
  });

  await assert.rejects(
    () => markClosingPaid(closingB.id, carlos.id, clinicA.id),
    /Fechamento não encontrado/
  );
  const paid = await markClosingPaid(closingB.id, carlos.id, clinicB.id);
  assert.equal(paid.status, "paid");

  const eventsA = await listFinanceEvents(clinicA.id);
  const eventsB = await listFinanceEvents(clinicB.id);
  assert.ok(eventsA.every((e) => e.clinicId === clinicA.id));
  assert.ok(eventsB.every((e) => e.clinicId === clinicB.id));
  assert.ok(!eventsA.some((e) => eventsB.some((b) => b.id === e.id)));

  const resumoA = await clinicExecutiveResumo(clinicA.id);
  assert.ok(resumoA.alerts.length >= 1);
  assert.equal(
    resumoA.month.producedCents,
    (await listEncounters(clinicA.id)).reduce((s, e) => s + e.feeCents, 0)
  );

  const active = await updateClinicStatus(clinicA.id, "active");
  assert.equal(active.status, "active");
  const back = await updateClinicStatus(clinicA.id, "pilot");
  assert.equal(back.status, "pilot");

  const audit = await listAudit({ action: "create_clinic", limit: 20 });
  assert.ok(Array.isArray(audit));

  const after = await readDb();
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.length, 0, dropped.join(", "));

  console.log("clinic-isolation ok", { a: clinicA.id, b: clinicB.id, closingB: closingB.code });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
