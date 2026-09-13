import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { addMembership, createClinic } from "../src/lib/platform-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";
import {
  assignLicense,
  cancelLicense,
  computeMrr,
  getActiveLicenseForClinic,
  getActiveLicenseForDoctor,
  getMrrSummary,
  listPlans,
} from "../src/lib/saas-store";

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

  const plans = await listPlans();
  assert.ok(plans.length >= 3, "catálogo padrão");
  const clinica = plans.find((p) => p.name === "Clínica") || plans[1];
  assert.ok(clinica.monthlyCents > 0);

  const clinic = await createClinic({ name: "SaaS Clinica Teste", city: "Salvador" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });

  await assert.rejects(
    () => assignLicense({ planId: clinica.id, clinicId: clinic.id, doctorId: carlos.id }),
    /clínica ou do médico solo/
  );

  const lic = await assignLicense({ planId: clinica.id, clinicId: clinic.id, status: "active" });
  assert.equal(lic.clinicId, clinic.id);
  assert.equal(lic.doctorId, null);
  assert.equal(lic.monthlyCents, clinica.monthlyCents);
  const found = await getActiveLicenseForClinic(clinic.id);
  assert.equal(found?.id, lic.id);

  const mrr1 = computeMrr([lic]);
  assert.equal(mrr1.mrrCents, clinica.monthlyCents);
  assert.equal(mrr1.licensesActive, 1);

  const replaced = await assignLicense({ planId: plans[0].id, clinicId: clinic.id });
  assert.notEqual(replaced.id, lic.id);
  const afterReplace = await getActiveLicenseForClinic(clinic.id);
  assert.equal(afterReplace?.id, replaced.id);

  const canceled = await cancelLicense(replaced.id);
  assert.equal(canceled.status, "canceled");
  assert.equal(await getActiveLicenseForClinic(clinic.id), null);

  const solo = await assignLicense({ planId: plans[0].id, doctorId: carlos.id, status: "trial" });
  assert.equal(solo.clinicId, null);
  assert.equal((await getActiveLicenseForDoctor(carlos.id))?.id, solo.id);

  const summary = await getMrrSummary();
  assert.equal(summary.mrrCents, plans[0].monthlyCents);
  assert.equal(summary.arrCents, plans[0].monthlyCents * 12);

  const after = await readDb();
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.length, 0, dropped.join(", "));

  console.log("saas ok", { mrr: summary.mrrCents, plans: plans.length, carlosId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
