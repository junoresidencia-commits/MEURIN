import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { addMembership, createClinic } from "../src/lib/platform-store";
import { createEncounter, recordCheckIn, upsertFeeRule } from "../src/lib/clinic-finance-store";
import { addClosingAdjustment, createClosing, listClosings, markClosingPaid, netDoctorPayout, previewClosing } from "../src/lib/clinic-closing-store";
import { buildClosingPdf, buildPayoutReceiptPdf } from "../src/lib/clinic-closing-pdf";
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

  const clinic = await createClinic({ name: "Fechamento Teste", city: "Salvador" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "MEDICO" });
  await upsertFeeRule({ clinicId: clinic.id, doctorId: carlos.id, feeCents: 45000, clinicSharePercent: 20 });

  const enc = await createEncounter({
    clinicId: clinic.id,
    doctorId: carlos.id,
    patientKey: "fechamento.teste@meurim.local",
    patientName: "Paciente Fechamento",
  });
  await recordCheckIn({ clinicId: clinic.id, encounterId: enc.id, method: "pix", amountCents: 45000 });

  const year = new Date().getFullYear();
  const closing = await createClosing({
    clinicId: clinic.id,
    doctorId: carlos.id,
    periodFrom: `${year}-01-01`,
    periodTo: `${year}-12-31`,
    createdBy: carlos.id,
  });
  assert.match(closing.code, new RegExp(`^MED-${year}-\\d{6}$`));
  assert.equal(closing.code, `MED-${year}-000001`);
  assert.equal(closing.status, "closed");
  assert.equal(closing.producedCents, 45000);
  assert.equal(closing.doctorShareCents, 36000);

  const preview = await previewClosing({
    clinicId: clinic.id,
    doctorId: carlos.id,
    periodFrom: `${year}-01-01`,
    periodTo: `${year}-12-31`,
  });
  assert.ok(preview.existing);
  assert.equal(preview.existing?.code, closing.code);
  assert.ok(preview.warnings.some((w) => /Já existe um fechamento/.test(w)));

  await assert.rejects(
    () => createClosing({ clinicId: clinic.id, doctorId: carlos.id, periodFrom: `${year}-01-01`, periodTo: `${year}-12-31`, createdBy: carlos.id }),
    /Já existe um fechamento para este médico e período/
  );

  await assert.rejects(
    () => addClosingAdjustment({ closingId: closing.id, clinicId: clinic.id, kind: "credit", amountCents: 1000, reason: "bonus extra" }),
    /depois do repasse pago/
  );

  const paid = await markClosingPaid(closing.id, carlos.id);
  assert.equal(paid.status, "paid");

  const adj = await addClosingAdjustment({
    closingId: closing.id,
    clinicId: clinic.id,
    kind: "credit",
    amountCents: 5000,
    reason: "Complemento combinado na reunião",
    createdByEmail: "carlos@meurim.com",
  });
  assert.equal(adj.reason.includes("Complemento"), true);
  assert.equal(netDoctorPayout(paid, [adj]), 41000);

  const pdf = await buildClosingPdf({
    clinicName: clinic.name,
    doctorName: carlos.name,
    closing: paid,
    adjustments: [adj],
    encounters: [enc],
  });
  assert.equal(Buffer.from(pdf.subarray(0, 4)).toString(), "%PDF");

  const receipt = await buildPayoutReceiptPdf({
    clinicName: clinic.name,
    doctorName: carlos.name,
    closing: paid,
    adjustments: [adj],
  });
  assert.equal(Buffer.from(receipt.subarray(0, 4)).toString(), "%PDF");

  const list = await listClosings(clinic.id);
  assert.equal(list[0].code, closing.code);

  const after = await readDb();
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.length, 0, dropped.join(", "));

  console.log("clinic-closing ok", { code: closing.code, net: 41000 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
