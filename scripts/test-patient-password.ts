/**
 * Primeiro acesso: cria senha sem pedir a atual.
 * Cobre flag ausente + senha ainda em 123456 (o bug da tela "Senha atual incorreta").
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

async function main() {
  const DATA = path.join(process.cwd(), "data");
  await mkdir(DATA, { recursive: true });
  await rm(path.join(DATA, "patients.json"), { force: true });

  const {
    createPatient,
    canSkipCurrentPassword,
    patientNeedsPasswordSetup,
    verifyPatientPassword,
    setPatientPassword,
    getPatient,
    DEFAULT_PATIENT_PASSWORD,
  } = await import("../src/lib/patients-store");

  const first = await createPatient({
    doctorId: "doc-a",
    name: "Primeiro Acesso",
    cpf: "39053344705",
  });
  assert.equal(first.mustChangePassword, true);
  assert.equal(await patientNeedsPasswordSetup(first), true);
  assert.equal(await canSkipCurrentPassword(first, false), true);
  assert.equal(await canSkipCurrentPassword(first, true), true);
  assert.equal(await verifyPatientPassword(first, DEFAULT_PATIENT_PASSWORD), true);

  await setPatientPassword(first.id, "minhasenha8");
  const afterFirst = await getPatient(first.id);
  assert.ok(afterFirst);
  assert.equal(afterFirst!.mustChangePassword, false);
  assert.equal(await verifyPatientPassword(afterFirst!, "minhasenha8"), true);
  assert.equal(await canSkipCurrentPassword(afterFirst!, false), false);
  assert.equal(await canSkipCurrentPassword(afterFirst!, true), true, "tela de 1º acesso não pede senha atual");
  assert.equal(await patientNeedsPasswordSetup(afterFirst!), false);

  const staleFlag = await createPatient({
    doctorId: "doc-a",
    name: "Flag Ausente",
    cpf: "39053344713",
    passwordHash: await bcrypt.hash(DEFAULT_PATIENT_PASSWORD, 10),
    mustChangePassword: false,
  });
  assert.equal(staleFlag.mustChangePassword, false);
  assert.equal(await patientNeedsPasswordSetup(staleFlag), true, "ainda no 123456 = precisa criar senha");
  assert.equal(await canSkipCurrentPassword(staleFlag, false), true);
  assert.equal(await canSkipCurrentPassword(staleFlag, true), true);

  const own = await createPatient({
    doctorId: "",
    name: "Conta Propria",
    cpf: "11144477735",
    passwordHash: await bcrypt.hash("senhaescolhida9", 10),
    mustChangePassword: false,
  });
  assert.equal(await patientNeedsPasswordSetup(own), false);
  assert.equal(await canSkipCurrentPassword(own, false), false);
  assert.equal(await canSkipCurrentPassword(own, true), true);

  console.log("patient-password ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
