/**
 * Carga sintética. Recusa env de produção.
 * Cria N pacientes locais de um médico demo — nunca no Supabase real.
 */
import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { createPatient } from "../src/lib/patients-store";
import { searchPatientsForDoctor } from "../src/lib/patients-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: carga proibida com env de produção.");
    process.exit(1);
  }
  const n = Math.min(Number(process.env.LOAD_PATIENTS || 80), 200);
  const before = await collectIntegrityCounts();
  const db = await readDb();
  const carlos = db.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos);

  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await createPatient({
      doctorId: carlos.id,
      name: `Carga Teste ${String(i).padStart(4, "0")}`,
      cpf: `00000000${String(10000 + i).slice(-5)}`.slice(-11),
      phone: `7199999${String(i).padStart(4, "0")}`,
      birthdate: "1980-01-15",
      email: `carga.${i}@meurim.local`,
    });
  }
  const createdMs = Date.now() - t0;
  const t1 = Date.now();
  const found = await searchPatientsForDoctor(carlos.id, "Carga Teste 0001", 20);
  const searchMs = Date.now() - t1;
  assert.ok(found.length >= 1);

  const after = await collectIntegrityCounts();
  const dropped = countsDropped(before, after);
  assert.equal(dropped.length, 0, dropped.join(", "));
  console.log("load-test-staging ok", { n, createdMs, searchMs, patients: after.patients });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
