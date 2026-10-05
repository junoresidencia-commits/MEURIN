/**
 * Cadastro feito pelo paciente: nome + CPF, sem médico vinculado.
 * Em produção doctor_id ainda é NOT NULL; o store usa sentinela e o app trata como sem médico.
 */
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

async function main() {
  const DATA = path.join(process.cwd(), "data");
  await mkdir(DATA, { recursive: true });
  await rm(path.join(DATA, "patients.json"), { force: true });

  const { createPatient, findByCpfAny, updatePatient, isUnassignedDoctorId, UNASSIGNED_DOCTOR_ID } = await import(
    "../src/lib/patients-store"
  );

  assert.equal(isUnassignedDoctorId(""), true);
  assert.equal(isUnassignedDoctorId(null), true);
  assert.equal(isUnassignedDoctorId(UNASSIGNED_DOCTOR_ID), true);
  assert.equal(isUnassignedDoctorId("f3eb902d-f527-4dd0-b1ec-a0d1a2bb6dc4"), false);

  const created = await createPatient({
    doctorId: "",
    name: "Paciente Autocadastro",
    cpf: "39053344705",
    email: "autocadastro@example.invalid",
    phone: "73999000000",
    passwordHash: "hash-de-teste",
  });
  assert.equal(created.doctorId, "");
  assert.equal(created.name, "Paciente Autocadastro");

  const found = await findByCpfAny("390.533.447-05");
  assert.ok(found);
  assert.equal(found!.id, created.id);
  assert.equal(found!.doctorId, "");

  const linked = await updatePatient(created.id, { doctorId: "doc-real" });
  assert.equal(linked?.doctorId, "doc-real");

  console.log("patient-register ok", created.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
