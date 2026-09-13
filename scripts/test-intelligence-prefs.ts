import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { extractClinicalFields } from "../src/lib/clinical-intelligence";
import { suggestForReview, DEFAULT_INTEL_PREFS, mergeIntelPrefs } from "../src/lib/intelligence-prefs";
import { getEffectivePrefs, upsertPrefs } from "../src/lib/intelligence-prefs-store";
import { reprocessPatient } from "../src/lib/clinical-intelligence-apply";
import { getProfile } from "../src/lib/clinical-profile-store";
import { addMembership, createClinic } from "../src/lib/platform-store";
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

  const sample = "Paciente com HAS e DM2. DRC 3b. TFGe 38. RAC 720. Losartana 100 mg. Ex-tabagista.";
  const detected = extractClinicalFields(sample);
  const all = suggestForReview(detected, DEFAULT_INTEL_PREFS);
  assert.ok(all.some((d) => d.key === "has"), "HAS sugerida no padrão");
  assert.ok(all.some((d) => d.key === "dm"), "DM sugerida no padrão");

  const noComo = suggestForReview(detected, {
    ...DEFAULT_INTEL_PREFS,
    modules: { ...DEFAULT_INTEL_PREFS.modules, comorbidities: false },
  });
  assert.equal(noComo.some((d) => d.key === "has"), false, "módulo desligado não sugere HAS");
  assert.ok(noComo.some((d) => d.key === "estagio_g") || noComo.some((d) => d.key === "drc"), "rim continua ligado");

  const off = suggestForReview(detected, { ...DEFAULT_INTEL_PREFS, enabled: false });
  assert.equal(off.length, 0, "desligada não sugere nada");

  const merged = mergeIntelPrefs(DEFAULT_INTEL_PREFS, { modules: { comorbidities: false } }, "clinic");
  assert.equal(merged.applyMode, "review_only");
  assert.equal(merged.modules.comorbidities, false);
  assert.equal(merged.modules.kidney, true);

  const clinic = await createClinic({ name: "Intel Clinica Teste", city: "Salvador" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await upsertPrefs({
    scope: "clinic",
    scopeId: clinic.id,
    enabled: true,
    modules: { urine: false },
  });
  await upsertPrefs({
    scope: "doctor",
    scopeId: carlos.id,
    enabled: true,
    modules: { meds: false },
    allowBackfill: true,
  });
  const effective = await getEffectivePrefs(carlos.id);
  assert.equal(effective.applyMode, "review_only");
  assert.equal(effective.source, "doctor");
  assert.equal(effective.modules.meds, false, "override do médico");

  const key = "antenor.teste@meurim.local";
  const profileBefore = await getProfile(key);
  const row = await reprocessPatient(key, carlos.id, "Antenor");
  assert.equal(row.applied, 0, "relê nunca grava");
  const profileAfter = await getProfile(key);
  assert.deepEqual(profileAfter?.data || {}, profileBefore?.data || {}, "perfil intacto após reler");

  const after = await readDb();
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.length, 0, dropped.join(", "));

  console.log("intelligence-prefs ok", { pending: row.pending, applied: row.applied, source: effective.source });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
