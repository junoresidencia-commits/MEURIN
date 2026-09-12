import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { ensureFounderSuperAdmin, grantRole, listActiveRoles, createClinic, listClinics, countPlatformRows } from "../src/lib/platform-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";
import { FOUNDER_SUPER_ADMIN_EMAIL } from "../src/lib/platform-types";

async function main() {
  const before = await collectIntegrityCounts();
  const db = await readDb();
  const doctorsBefore = db.doctors.map((d) => ({ id: d.id, email: d.email, passwordHash: d.passwordHash }));

  const founder = db.doctors.find((d) => d.email.toLowerCase() === FOUNDER_SUPER_ADMIN_EMAIL);
  const boot = await ensureFounderSuperAdmin();
  if (!founder) {
    assert.equal(boot.granted, false, "não cria usuário quando o fundador não existe");
    assert.equal(boot.doctorId, null);
  } else {
    assert.equal(boot.doctorId, founder.id, "usa o ID já existente");
    const roles = await listActiveRoles("doctor", founder.id);
    assert.ok(roles.includes("SUPER_ADMIN"));
  }

  const carlos = db.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos, "seed do Dr. Carlos permanece");
  const carlosId = carlos.id;
  const carlosHash = carlos.passwordHash;
  await grantRole("doctor", carlos.id, "SUPER_ADMIN", "test");
  const roles = await listActiveRoles("doctor", carlos.id);
  assert.ok(roles.includes("SUPER_ADMIN"));

  const afterGrant = await readDb();
  const carlosAfter = afterGrant.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.equal(carlosAfter?.id, carlosId, "ID do médico não muda");
  assert.equal(carlosAfter?.passwordHash, carlosHash, "senha não muda");
  assert.equal(afterGrant.doctors.length, doctorsBefore.length, "não cria médico extra");

  const clinic = await createClinic({ name: "Medclin Teste", city: "Salvador" });
  const clinics = await listClinics();
  assert.ok(clinics.some((c) => c.id === clinic.id));

  const after = await collectIntegrityCounts();
  const dropped = countsDropped(before, after);
  assert.equal(dropped.length, 0, `contagem clínica diminuiu: ${dropped.join(", ")}`);
  assert.ok(after.clinics >= before.clinics);
  assert.ok(after.roleAssignments >= before.roleAssignments);

  const platform = await countPlatformRows();
  assert.ok(platform.clinics >= 1);

  console.log("platform-foundation ok", {
    founderEmail: FOUNDER_SUPER_ADMIN_EMAIL,
    founderPresent: Boolean(founder),
    doctors: after.doctors,
    patients: after.patients,
    notes: after.clinicalNotes,
    clinics: after.clinics,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
