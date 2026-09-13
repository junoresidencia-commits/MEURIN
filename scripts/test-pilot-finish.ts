import assert from "node:assert/strict";
import { searchPatientsForDoctor, createPatient } from "../src/lib/patients-store";
import { listBookingsForDoctor, readDb } from "../src/lib/store";
import { sessionSecret } from "../src/lib/session-secret";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para produção.");
    process.exit(1);
  }
  assert.equal(sessionSecret(), process.env.SESSION_SECRET || "meu-rim-dev-secret-change-me");

  const before = await collectIntegrityCounts();
  const db = await readDb();
  const carlos = db.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos);

  const p = await createPatient({
    doctorId: carlos.id,
    name: "Busca Nascimento Teste",
    birthdate: "1975-03-21",
    cpf: "52998224725",
    phone: "71988887777",
    email: "busca.nasc@meurim.local",
  });
  const byName = await searchPatientsForDoctor(carlos.id, "Nascimento", 20);
  assert.ok(byName.some((x) => x.id === p.id));
  const byDob = await searchPatientsForDoctor(carlos.id, "21/03/1975", 20);
  assert.ok(byDob.some((x) => x.id === p.id));
  const byCpf = await searchPatientsForDoctor(carlos.id, "52998224725", 20);
  assert.ok(byCpf.some((x) => x.id === p.id));

  const books = await listBookingsForDoctor(carlos.id, "2000-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z");
  assert.ok(Array.isArray(books));

  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.filter((d) => !d.startsWith("patients")).length, 0, dropped.join(", "));
  console.log("pilot-finish ok", { search: byDob.length, bookings: books.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
