import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { createStudy } from "../src/lib/research-studies-store";
import { canExportStudy } from "../src/lib/research-governance";
import { exportGate, getProtocol, upsertConsent, upsertProtocol } from "../src/lib/research-governance-store";
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

  assert.equal(canExportStudy({ ethicsStatus: "none" }).ok, false);
  assert.equal(canExportStudy({ ethicsStatus: "approved", protocolCode: "" }).ok, false);
  assert.equal(canExportStudy({ ethicsStatus: "waived", waiverReason: "curto" }).ok, false);
  assert.equal(
    canExportStudy({
      ethicsStatus: "approved",
      protocolCode: "CEP-123",
      studyType: "coorte_prosp",
      givenConsents: 0,
    }).ok,
    false
  );
  assert.equal(
    canExportStudy({ ethicsStatus: "waived", waiverReason: "Estudo retrospectivo só com dados anonimizados do serviço." }).ok,
    true
  );

  const study = await createStudy({
    doctorId: carlos.id,
    type: "coorte_retro",
    title: "Governança teste",
    question: "A TFGe cai?",
    filters: [],
    variables: [],
    status: "rascunho",
  });
  const empty = await getProtocol(study.id, carlos.id);
  assert.equal(empty.ethicsStatus, "none");
  assert.equal((await exportGate(study.id, carlos.id, study.type)).ok, false);

  await upsertProtocol({
    studyId: study.id,
    doctorId: carlos.id,
    ethicsStatus: "waived",
    waiverReason: "Retrospectivo com banco anonimizado do próprio médico.",
  });
  const gate = await exportGate(study.id, carlos.id, "coorte_retro");
  assert.equal(gate.ok, true, gate.reason);

  const prosp = await createStudy({
    doctorId: carlos.id,
    type: "coorte_prosp",
    title: "Prospectivo teste",
    question: "Consentimento",
    filters: [],
    variables: [],
    status: "coleta",
  });
  await upsertProtocol({
    studyId: prosp.id,
    doctorId: carlos.id,
    ethicsStatus: "approved",
    protocolCode: "CEP-999",
    ethicsBody: "CEP Teste",
  });
  assert.equal((await exportGate(prosp.id, carlos.id, "coorte_prosp")).ok, false);
  await upsertConsent({
    studyId: prosp.id,
    doctorId: carlos.id,
    patientKey: "antenor.teste@meurim.local",
    patientName: "Antenor",
    status: "given",
  });
  assert.equal((await exportGate(prosp.id, carlos.id, "coorte_prosp")).ok, true);

  const after = await readDb();
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.length, 0, dropped.join(", "));

  console.log("research-governance ok", { waived: gate.ok, prosp: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
