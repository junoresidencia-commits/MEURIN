/**
 * HTTP: aba Primeira Consulta (coorte, exames da chegada, exportação CEP).
 * Uso: DEMO_URL=http://127.0.0.1:3000 SEED_DEMO=1 npx tsx scripts/test-first-visit-http.ts
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const BASE = process.env.DEMO_URL || "http://127.0.0.1:3000";

function cookieJar() {
  let cookie = "";
  return {
    header() { return cookie; },
    absorb(res: Response) {
      const raw = res.headers.getSetCookie?.() || [];
      const next = raw.map((c) => c.split(";")[0]).filter(Boolean);
      if (next.length) cookie = [...new Set([...cookie.split("; ").filter(Boolean), ...next])].join("; ");
    },
  };
}

async function req(jar: ReturnType<typeof cookieJar>, pathName: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${pathName}`, {
    ...init,
    headers: { "Content-Type": "application/json", cookie: jar.header(), ...(init?.headers || {}) },
  });
  jar.absorb(res);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* boot */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE}`);
}

async function main() {
  await waitReady();
  const stamp = Date.now().toString(36);
  const doctor = cookieJar();
  const login = await req(doctor, "/api/auth", { method: "POST", body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }) });
  assert.equal(login.res.status, 200, JSON.stringify(login.json));
  const me = await req(doctor, "/api/auth");
  const doctorId = String(me.json.doctor?.id || "");
  assert.ok(doctorId, "login do médico demo");

  const studies = await req(doctor, "/api/pesquisa/studies");
  assert.equal(studies.res.status, 200, "pesquisa existente continua");
  assert.ok(Array.isArray(studies.json.studies));

  const anaEmail = `ana.pc.${stamp}@meurim.com`;
  const joaoEmail = `joao.pc.${stamp}@meurim.com`;
  const retornoEmail = `retorno.pc.${stamp}@meurim.com`;

  const ana = await req(doctor, "/api/doctor/patients", {
    method: "POST",
    body: JSON.stringify({
      name: "Ana Primeira Consulta",
      email: anaEmail,
      cpf: String(10000000000 + (parseInt(stamp, 36) % 8999999999)).padStart(11, "0").slice(0, 11),
      birthdate: "1960-01-15",
      sex: "feminino",
      address: "Irecê - BA",
      diseases: "HAS e DM",
      medications: "Losartana 50 mg",
      force: true,
    }),
  });
  assert.ok([200, 201].includes(ana.res.status), JSON.stringify(ana.json));

  const joao = await req(doctor, "/api/doctor/patients", {
    method: "POST",
    body: JSON.stringify({
      name: "João Sem Exames",
      email: joaoEmail,
      birthdate: "1980-06-01",
      sex: "masculino",
      address: "Lapão - BA",
      force: true,
    }),
  });
  assert.ok([200, 201].includes(joao.res.status), JSON.stringify(joao.json));

  const ret = await req(doctor, "/api/doctor/patients", {
    method: "POST",
    body: JSON.stringify({
      name: "Carlos Só Retorno",
      email: retornoEmail,
      birthdate: "1972-03-03",
      sex: "masculino",
      address: "Xique-Xique - BA",
      force: true,
    }),
  });
  assert.ok([200, 201].includes(ret.res.status), JSON.stringify(ret.json));

  const visit = "2024-03-10T14:00:00.000Z";
  const enc = (e: string) => encodeURIComponent(e);
  const labs = await req(doctor, `/api/doctor/patients/${enc(anaEmail)}/labs`, {
    method: "POST",
    body: JSON.stringify({ results: [
      { testKey: "creatinina", value: 2.8, measuredAt: "2024-03-08" },
      { testKey: "potassio", value: 5.4, measuredAt: "2024-03-08" },
      { testKey: "rac", value: 120, measuredAt: "2024-06-01" },
    ] }),
  });
  assert.ok(labs.res.status === 201 || labs.res.status === 200, JSON.stringify(labs.json));

  const note = await req(doctor, `/api/doctor/patients/${enc(anaEmail)}/notes`, {
    method: "POST",
    body: JSON.stringify({
      chiefComplaint: "Encaminhada pela UBS",
      history: "HAS e DM. PA 160x100. Chegou com creatinina. USG rins mencionada.",
      assessment: "DRC avançada",
      plan: "Solicitar RAC",
    }),
  });
  assert.equal(note.res.status, 201, JSON.stringify(note.json));

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  const mkBooking = (email: string, name: string, slotStart: string, extra: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    doctorId,
    patientName: name,
    patientEmail: email,
    patientPhone: "73999000000",
    patientCity: extra.patientCity || "Irecê",
    careReason: extra.careReason || "pressa",
    slotStart,
    slotEnd: new Date(new Date(slotStart).getTime() + 30 * 60_000).toISOString(),
    priceCents: 0,
    paymentMethod: "pix",
    status: "confirmed",
    meetingRoomId: randomUUID(),
    confirmationEmailSent: false,
    createdAt: slotStart,
    stage: "confirmada",
    ...extra,
  });
  db.bookings.push(
    mkBooking(anaEmail, "Ana Primeira Consulta", visit, { careReason: "pressa", patientCity: "Irecê", locationName: "Clínica Centro" }),
    mkBooking(anaEmail, "Ana Primeira Consulta", "2024-09-10T14:00:00.000Z", { courtesyKind: "retorno", careReason: "acompanhamento", patientCity: "Irecê" }),
    mkBooking(joaoEmail, "João Sem Exames", "2024-04-02T10:00:00.000Z", { careReason: "acompanhamento", patientCity: "Lapão" }),
    mkBooking(retornoEmail, "Carlos Só Retorno", "2024-05-01T10:00:00.000Z", { courtesyKind: "retorno", careReason: "acompanhamento", patientCity: "Xique-Xique" })
  );
  await writeFile(dbPath, JSON.stringify(db, null, 2));

  const coorte = await req(doctor, `/api/pesquisa/primeira-consulta?anonymize=1`);
  assert.equal(coorte.res.status, 200, JSON.stringify(coorte.json));
  const patients = coorte.json.patients as Array<Record<string, unknown>>;
  assert.ok(patients.length >= 3, `esperava ≥3, veio ${patients.length}`);
  assert.ok(patients.every((p) => String(p.codigo).startsWith("P")));
  assert.ok(patients.every((p) => !("nome" in p) || !p.nome));
  const blob = JSON.stringify(coorte.json);
  assert.equal(blob.includes("Ana Primeira"), false, "exportação/tela anonimizada sem nome");
  assert.equal(blob.includes(anaEmail), false);

  const anaRow = patients.find((p) => p.municipio === "Irecê" || String(p.motivo || "").includes("Encaminhada") || p.creatinina === 2.8);
  assert.ok(anaRow, "Ana deve aparecer uma vez");
  assert.equal(anaRow!.creatinina, 2.8);
  assert.equal(anaRow!.chegou_sem_exames, "nao");
  assert.equal(anaRow!.certeza, "confirmada");
  const anaExams = anaRow!.exames as Array<{ key: string; status: string }>;
  assert.equal(anaExams.find((e) => e.key === "creatinina")?.status, "disponivel");
  assert.equal(anaExams.find((e) => e.key === "rac")?.status, "solicitado_apos");

  const joaoRow = patients.find((p) => p.municipio === "Lapão" || p.chegou_sem_exames === "sim");
  assert.ok(joaoRow);
  const retornoRow = patients.find((p) => p.municipio === "Xique-Xique" || p.certeza === "incerta");
  assert.ok(retornoRow, "retorno isolado entra com incerteza");
  assert.equal(retornoRow!.certeza, "incerta");

  const filtered = await req(doctor, `/api/pesquisa/primeira-consulta?municipio=Irece&anonymize=1`);
  assert.ok((filtered.json.patients as unknown[]).every((p) => /irec/i.test(String((p as { municipio: string }).municipio))));

  const blocked = await req(doctor, "/api/pesquisa/primeira-consulta/export", {
    method: "POST",
    body: JSON.stringify({ format: "xlsx", rowCount: patients.length }),
  });
  assert.equal(blocked.res.status, 403);

  const gov = await req(doctor, "/api/pesquisa/primeira-consulta/governance", {
    method: "PUT",
    body: JSON.stringify({
      ethicsStatus: "waived",
      waiverReason: "Estudo retrospectivo só com dados anonimizados do próprio serviço.",
    }),
  });
  assert.equal(gov.res.status, 200, JSON.stringify(gov.json));
  assert.equal(gov.json.export.ok, true);

  const allowed = await req(doctor, "/api/pesquisa/primeira-consulta/export", {
    method: "POST",
    body: JSON.stringify({ format: "xlsx", rowCount: patients.length }),
  });
  assert.equal(allowed.res.status, 200, JSON.stringify(allowed.json));

  const studiesAfter = await req(doctor, "/api/pesquisa/studies");
  assert.equal(studiesAfter.res.status, 200);
  assert.deepEqual(studiesAfter.json.studies, studies.json.studies);

  console.log("primeira-consulta http ok", { n: coorte.json.n, stats: coorte.json.stats });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
