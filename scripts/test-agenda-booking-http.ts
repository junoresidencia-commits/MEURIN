/**
 * HTTP: agenda só de retorno ainda aparece para marcar; paciente envia retorno sem consulta registrada.
 * DEMO_URL=http://127.0.0.1:3020 npx tsx scripts/test-agenda-booking-http.ts
 */
import assert from "node:assert/strict";

const BASE = process.env.DEMO_URL || "http://127.0.0.1:3020";

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

async function req(jar: ReturnType<typeof cookieJar>, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", cookie: jar.header(), ...(init?.headers || {}) },
  });
  jar.absorb(res);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  const doctors = await fetch(`${BASE}/api/doctors`).then((r) => r.json());
  const carlos = (doctors as { id: string; name: string }[]).find((d) => /Carlos/i.test(d.name));
  assert.ok(carlos, "Dr. Carlos precisa existir no seed");

  const doctor = cookieJar();
  const loginD = await req(doctor, "/api/auth", { method: "POST", body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }) });
  assert.equal(loginD.res.status, 200, JSON.stringify(loginD.json));

  const mae = await req(doctor, "/api/doctor/locations", {
    method: "POST",
    body: JSON.stringify({ name: "Clínica mãe", city: "Irecê", type: "clinica" }),
  });
  assert.equal(mae.res.status, 201, JSON.stringify(mae.json));
  const salute = await req(doctor, "/api/doctor/locations", {
    method: "POST",
    body: JSON.stringify({ name: "Clínica Salute", city: "Irecê", type: "clinica" }),
  });
  assert.equal(salute.res.status, 201, JSON.stringify(salute.json));
  const maeId = String(mae.json.location.id);
  const saluteId = String(salute.json.location.id);

  const periods = [1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
    { id: `mae-${dayOfWeek}`, dayOfWeek, start: "09:00", end: "12:00", modality: "presencial", locationId: maeId, durationMin: 30, intervalMin: 10, priceCents: 45000, visitKind: "ambos" },
    { id: `salute-${dayOfWeek}`, dayOfWeek, start: "14:30", end: "16:00", modality: "presencial", locationId: saluteId, durationMin: 30, intervalMin: 10, priceCents: 45000, visitKind: "ambos" },
    { id: `tele-${dayOfWeek}`, dayOfWeek, start: "16:30", end: "22:00", modality: "teleconsulta", durationMin: 30, intervalMin: 10, visitKind: "ambos" },
  ]);
  const saved = await req(doctor, "/api/availability", {
    method: "PUT",
    body: JSON.stringify({ availabilityPeriods: periods, tz: "America/Bahia" }),
  });
  assert.equal(saved.res.status, 200, JSON.stringify(saved.json));

  const allSlots = await fetch(`${BASE}/api/availability?doctorId=${carlos.id}`).then((r) => r.json());
  const slots = (allSlots.slots || []) as { modality?: string; locationName?: string; locationCity?: string }[];
  assert.ok(slots.length > 0, "agenda publicada aparece para o paciente");
  assert.ok(slots.some((s) => s.modality === "presencial" && String(s.locationName).includes("Clínica mãe")), "presencial Clínica mãe");
  assert.ok(slots.some((s) => s.modality === "presencial" && String(s.locationName).includes("Clínica Salute")), "presencial Clínica Salute");
  assert.ok(slots.some((s) => s.modality === "teleconsulta"), "teleconsulta");

  const consultSlots = allSlots;
  const returnSlots = await fetch(`${BASE}/api/availability?doctorId=${carlos.id}&visit=retorno`).then((r) => r.json());
  assert.ok((returnSlots.slots || []).length > 0, "horários de retorno publicados");

  const proRetorno = await fetch(`${BASE}/api/professionals/doctor/${carlos.id}?visit=retorno`).then((r) => r.json());
  assert.ok((proRetorno.slots || []).length > 0, "wizard de retorno lista a agenda publicada");
  assert.equal(proRetorno.lastVisit, null);
  assert.equal(proRetorno.knownPatient, false);

  const wizard = await fetch(`${BASE}/paciente/agendar/doctor/${carlos.id}?tipo=retorno`);
  assert.ok(wizard.ok);
  const html = await wizard.text();
  assert.equal(/Consulta anterior informada por você/.test(html), false);

  const patient = cookieJar();
  const email = `agenda.marcar.${Date.now().toString(36)}@meurim.com`;
  const loginP = await req(patient, "/api/patient/session", { method: "POST", body: JSON.stringify({ email }) });
  assert.equal(loginP.res.status, 200, JSON.stringify(loginP.json));

  const slot = proRetorno.slots[0] as { start: string; end: string };
  const created = await req(patient, "/api/return-requests", {
    method: "POST",
    body: JSON.stringify({
      professionalKind: "doctor",
      professionalId: carlos.id,
      slotStart: slot.start,
      slotEnd: slot.end,
      alreadySeen: true,
      lastVisitApprox: "unknown",
    }),
  });
  assert.equal(created.res.status, 201, JSON.stringify(created.json));
  assert.equal(created.json.reserved, false);
  assert.equal(created.json.request.status, "pending_review");
  assert.ok(!created.json.request.bookingId);

  console.log("agenda-booking-http ok", {
    doctor: carlos.id,
    consultSlots: consultSlots.slots.length,
    returnSlots: returnSlots.slots.length,
    presencial: slots.filter((s) => s.modality === "presencial").length,
    teleconsulta: slots.filter((s) => s.modality === "teleconsulta").length,
    requestId: created.json.request.id,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
