import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import path from "node:path";
import {
  ageFromBirthdate,
  AGE_BAND_PRESETS,
  hasAgeInfo,
  normalizeAgeReportedAt,
  parseAgeYears,
  resolvePatientAge,
} from "../src/lib/patient-age";
import { applyFilters, type Filter } from "../src/lib/research";
import { createPatient, listPatientsByDoctor, updatePatient } from "../src/lib/patients-store";

function mainUnit() {
  assert.equal(ageFromBirthdate("1965-05-12", "2026-09-24"), 61);
  assert.equal(ageFromBirthdate("1965-05-12", "2026-05-11"), 60);
  assert.equal(ageFromBirthdate("1965-05-12", "2026-05-12"), 61);
  assert.equal(ageFromBirthdate("not-a-date"), null);
  assert.equal(ageFromBirthdate(null), null);

  const withBirth = { birthdate: "1965-05-12", ageYears: 99, ageReportedAt: "2020-01-01" };
  assert.equal(resolvePatientAge(withBirth, "2026-09-24"), 61, "nascimento vence a idade manual");

  const manual = { birthdate: null, ageYears: 64, ageReportedAt: "2026-09-01" };
  assert.equal(resolvePatientAge(manual, "2026-09-15"), 64);
  assert.equal(resolvePatientAge(manual, "2027-10-01"), 65);
  assert.equal(resolvePatientAge(manual, "2025-08-01"), 62);

  const undated = { birthdate: null, ageYears: 64, ageReportedAt: null };
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  assert.equal(resolvePatientAge(undated, todayIso), 64);
  assert.equal(resolvePatientAge(undated, "2020-01-01"), null, "sem data de referência, não projeta para o passado");

  assert.equal(resolvePatientAge({}), null);
  assert.equal(hasAgeInfo({}), false);
  assert.equal(hasAgeInfo({ birthdate: "1965-05-12" }), true);
  assert.equal(hasAgeInfo({ ageYears: 64 }), true);
  assert.equal(parseAgeYears("64"), 64);
  assert.equal(parseAgeYears("200"), null);
  assert.equal(normalizeAgeReportedAt("09/2026"), "2026-09-01");
  assert.equal(normalizeAgeReportedAt("2026-09"), "2026-09-01");

  const recs = [
    { __id: "a", __name: "A", idade: 17 },
    { __id: "b", __name: "B", idade: 18 },
    { __id: "c", __name: "C", idade: 39 },
    { __id: "d", __name: "D", idade: 40 },
    { __id: "e", __name: "E", idade: 59 },
    { __id: "f", __name: "F", idade: 60 },
    { __id: "g", __name: "G", idade: null },
  ];
  const pick = (f: Filter) => applyFilters(recs, [f]).map((r) => r.__id).sort();
  const ge18 = AGE_BAND_PRESETS.find((p) => p.id === "ge18")!;
  const y18 = AGE_BAND_PRESETS.find((p) => p.id === "18-39")!;
  const y40 = AGE_BAND_PRESETS.find((p) => p.id === "40-59")!;
  const ge60 = AGE_BAND_PRESETS.find((p) => p.id === "ge60")!;
  assert.deepEqual(pick({ field: "idade", op: ge18.op, value: ge18.value }), ["b", "c", "d", "e", "f"]);
  assert.deepEqual(pick({ field: "idade", op: y18.op, value: y18.value, value2: y18.value2 }), ["b", "c"]);
  assert.deepEqual(pick({ field: "idade", op: y40.op, value: y40.value, value2: y40.value2 }), ["d", "e"]);
  assert.deepEqual(pick({ field: "idade", op: ge60.op, value: ge60.value }), ["f"]);
  assert.ok(!pick({ field: "idade", op: ">=", value: "0" }).includes("g"));
}

async function storeRoundtrip() {
  const file = path.join(process.cwd(), "data", "patients.json");
  try { unlinkSync(file); } catch { /* ok */ }

  const doctorId = "doc-age-test";
  const withBirth = await createPatient({
    doctorId,
    name: "João Silva",
    birthdate: "1965-05-12",
    sex: "masculino",
  });
  assert.equal(withBirth.birthdate, "1965-05-12");
  assert.equal(resolvePatientAge(withBirth, "2026-09-24"), 61);

  const manual = await createPatient({
    doctorId,
    name: "Maria Oliveira",
    birthdate: null,
    ageYears: 64,
    ageReportedAt: "2026-09-01",
    sex: "feminino",
  });
  assert.equal(manual.birthdate, null, "não inventa 01/01 a partir da idade");
  assert.equal(manual.ageYears, 64);
  assert.equal(resolvePatientAge(manual, "2026-09-15"), 64);

  const none = await createPatient({ doctorId, name: "Carlos Santos", sex: "masculino" });
  assert.equal(hasAgeInfo(none), false);
  assert.equal(resolvePatientAge(none), null);

  const filled = await updatePatient(none.id, { ageYears: 70, ageReportedAt: "2026-09-01" });
  assert.ok(filled);
  assert.equal(filled.birthdate, null);
  assert.equal(resolvePatientAge(filled, "2026-09-01"), 70);

  const list = await listPatientsByDoctor(doctorId);
  assert.equal(list.length, 3);
  assert.equal(list.filter((p) => !hasAgeInfo(p)).length, 0);

  try { unlinkSync(file); } catch { /* ok */ }
}

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }
  mainUnit();
  await storeRoundtrip();
  console.log("ok: idade (nascimento vence, manual datada, não inventa, faixas, dado ausente)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
