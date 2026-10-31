import assert from "node:assert/strict";
import { createPatient, deletePatient, clinicalKey } from "../src/lib/patients-store";
import { addLabResult, getLabResults } from "../src/lib/patient-store";
import { applyProfileChanges, getProfile } from "../src/lib/clinical-profile-store";
import { classifyAllPatientsForDoctor } from "../src/lib/research-classify";
import { buildCohortRecords } from "../src/lib/research";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const doctorId = "doc-classify-estudos";
  const created: string[] = [];

  try {
    const g3 = await createPatient({
      doctorId,
      name: "Classifica G3b A3",
      email: "classify-g3ba3@test.meurim.local",
      birthdate: "1968-01-15",
      sex: "masculino",
    });
    created.push(g3.id);
    const k3 = clinicalKey(g3);
    await addLabResult({
      patientEmail: k3,
      doctorId,
      testKey: "tfge",
      value: 38,
      unit: "mL/min/1,73m²",
      measuredAt: "2026-03-01T00:00:00.000Z",
    });
    await addLabResult({
      patientEmail: k3,
      doctorId,
      testKey: "rac",
      value: 720,
      unit: "mg/g",
      measuredAt: "2026-03-01T00:00:00.000Z",
    });

    const g1 = await createPatient({
      doctorId,
      name: "Classifica G1 A1",
      email: "classify-g1a1@test.meurim.local",
      birthdate: "1990-06-01",
      sex: "feminino",
    });
    created.push(g1.id);
    const k1 = clinicalKey(g1);
    await addLabResult({
      patientEmail: k1,
      doctorId,
      testKey: "tfge",
      value: 98,
      unit: "mL/min/1,73m²",
      measuredAt: "2026-03-01T00:00:00.000Z",
    });
    await addLabResult({
      patientEmail: k1,
      doctorId,
      testKey: "rac",
      value: 8,
      unit: "mg/g",
      measuredAt: "2026-03-01T00:00:00.000Z",
    });

    const crOnly = await createPatient({
      doctorId,
      name: "Classifica creatinina",
      email: "classify-cr@test.meurim.local",
      birthdate: "1968-01-15",
      sex: "masculino",
    });
    created.push(crOnly.id);
    const kCr = clinicalKey(crOnly);
    await addLabResult({
      patientEmail: kCr,
      doctorId,
      testKey: "creatinina",
      value: 1.9,
      unit: "mg/dL",
      measuredAt: "2026-03-01T00:00:00.000Z",
    });

    const manual = await createPatient({
      doctorId,
      name: "Classifica manual",
      email: "classify-manual@test.meurim.local",
      birthdate: "1975-02-02",
      sex: "feminino",
    });
    created.push(manual.id);
    const kM = clinicalKey(manual);
    await addLabResult({
      patientEmail: kM,
      doctorId,
      testKey: "tfge",
      value: 40,
      unit: "mL/min/1,73m²",
      measuredAt: "2026-03-01T00:00:00.000Z",
    });
    await applyProfileChanges(kM, doctorId, "médico", { estagio_g: "G3a", drc: "sim" }, "manual");

    const summary = await classifyAllPatientsForDoctor(doctorId, "teste");
    assert.ok(summary.total >= 4, `total ${summary.total}`);
    assert.ok(summary.classified >= 3, `classified ${summary.classified}`);
    assert.ok(summary.tfgeComputed >= 1, "TFGe CKD-EPI gravada");

    const p3 = await getProfile(k3);
    assert.equal(p3?.data.estagio_g, "G3b");
    assert.equal(p3?.data.categoria_a, "A3");
    assert.equal(p3?.data.drc, "sim");
    assert.equal(p3?.meta.estagio_g?.source, "cálculo");

    const p1 = await getProfile(k1);
    assert.equal(p1?.data.estagio_g, "G1");
    assert.equal(p1?.data.categoria_a, "A1");
    assert.equal(p1?.data.drc, "nao");

    const pCr = await getProfile(kCr);
    assert.ok(pCr?.data.estagio_g, "G a partir da creatinina");
    const tfgeLabs = (await getLabResults(kCr)).filter((l) => l.testKey === "tfge");
    assert.ok(tfgeLabs.length >= 1, "TFGe calculada persistida");
    assert.equal(tfgeLabs[0].origin, "cálculo");

    const pM = await getProfile(kM);
    assert.equal(pM?.data.estagio_g, "G3a", "manual não é sobrescrito");
    assert.equal(pM?.meta.estagio_g?.source, "manual");

    const cohort = await buildCohortRecords(doctorId);
    const r3 = cohort.find((r) => r.__id === g3.id);
    assert.ok(r3);
    assert.equal(r3.estagio_g, "G3b");
    assert.equal(r3.categoria_a, "A3");
    assert.equal(r3.drc, "sim");
    assert.equal(r3.kdigo, "G3bA3");
    assert.equal(r3.lab_tfge, 38);
    assert.equal(r3.lab_rac, 720);

    const r1 = cohort.find((r) => r.__id === g1.id);
    assert.equal(r1?.kdigo, "G1A1");
    assert.equal(r1?.drc, "nao");

    console.log("research-classify ok", summary);
  } finally {
    for (const id of created) {
      try { await deletePatient(id, doctorId); } catch { /* limpa o que der */ }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
