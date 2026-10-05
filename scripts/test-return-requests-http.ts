/**
 * HTTP: paciente solicita retorno → profissional valida (confirmar / recusar prazo).
 * Não reserva horário na criação. Uso: DEMO_URL=http://127.0.0.1:3020 npx tsx scripts/test-return-requests-http.ts
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

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/agendar`);
      if (r.ok) return;
    } catch { /* boot */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE}`);
}

async function main() {
  await waitReady();
  const stamp = Date.now().toString(36);
  const doctors = await fetch(`${BASE}/api/doctors`).then((r) => r.json());
  const carlos = (doctors as { id: string; name: string }[]).find((d) => /Carlos/i.test(d.name));
  assert.ok(carlos, "Dr. Carlos precisa existir no seed");

  const profilePage = await fetch(`${BASE}/profissional/doctor/${carlos.id}`);
  assert.ok(profilePage.ok, `perfil ${profilePage.status}`);
  const wizard = await fetch(`${BASE}/paciente/agendar/doctor/${carlos.id}`);
  assert.ok(wizard.ok, `wizard ${wizard.status}`);

  const proApi = await fetch(`${BASE}/api/professionals/doctor/${carlos.id}?visit=retorno`).then((r) => r.json());
  assert.equal(proApi.professional.id, carlos.id);
  assert.ok(Array.isArray(proApi.slots));

  const patient = cookieJar();
  const email = `joao.retorno.${stamp}@meurim.com`;
  const loginP = await req(patient, "/api/patient/session", { method: "POST", body: JSON.stringify({ email }) });
  assert.equal(loginP.res.status, 200, JSON.stringify(loginP.json));

  const slotStart = new Date(Date.now() + 3 * 86_400_000);
  slotStart.setHours(19, 0, 0, 0);
  const created = await req(patient, "/api/return-requests", {
    method: "POST",
    body: JSON.stringify({
      professionalKind: "doctor",
      professionalId: carlos.id,
      slotStart: slotStart.toISOString(),
      slotEnd: new Date(slotStart.getTime() + 30 * 60 * 1000).toISOString(),
      alreadySeen: true,
      lastVisitApprox: "month_year",
      lastVisitWhen: "2026-09",
      lastVisitLocation: "Clínica Salute",
      note: "Fiz consulta com o senhor no mês passado e os exames solicitados ficaram prontos.",
    }),
  });
  assert.equal(created.res.status, 201, JSON.stringify(created.json));
  assert.equal(created.json.reserved, false);
  const reqId = String(created.json.request.id);
  assert.equal(created.json.request.status, "pending_review");
  assert.ok(!created.json.request.bookingId, "não deve criar consulta na solicitação");

  const mine = await req(patient, `/api/return-requests/${reqId}`);
  assert.equal(mine.res.status, 200, JSON.stringify(mine.json));
  assert.equal(mine.json.you, "patient");
  assert.equal(mine.json.request.status, "pending_review");

  const atendimentos = await fetch(`${BASE}/paciente/atendimentos`, { headers: { cookie: patient.header() } });
  assert.ok(atendimentos.ok, `meus atendimentos ${atendimentos.status}`);

  const doctor = cookieJar();
  const loginD = await req(doctor, "/api/auth", { method: "POST", body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }) });
  assert.equal(loginD.res.status, 200, JSON.stringify(loginD.json));

  const inbox = await req(doctor, "/api/return-requests?as=professional");
  assert.ok((inbox.json.requests as { id: string }[]).some((r) => r.id === reqId), "inbox do médico deve listar a solicitação");

  const afterCreate = await req(doctor, `/api/return-requests/${reqId}`);
  assert.equal(afterCreate.json.you, "professional", JSON.stringify(afterCreate.json));
  const createMsgs = afterCreate.json.messages as { body: string; authorRole: string }[];
  assert.ok(createMsgs.some((m) => m.authorRole === "patient" && /exames solicitados/.test(m.body)), "nota do paciente deve aparecer no chat do profissional");

  const pingCreate = await req(doctor, "/api/notifications");
  const notesCreate = (pingCreate.json.notifications || []) as { type?: string; title?: string; targetUrl?: string }[];
  assert.ok(notesCreate.some((n) => n.type === "solicitacao_retorno" && String(n.targetUrl || "").includes(reqId)), "médico deve ser notificado da solicitação");

  const ask = await req(doctor, `/api/return-requests/${reqId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision: "ask_info" }),
  });
  assert.equal(ask.res.status, 200, JSON.stringify(ask.json));
  assert.equal(ask.json.request.status, "awaiting_patient");

  const reply = await req(patient, `/api/return-requests/${reqId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: "Foi no mês passado na Clínica Salute." }),
  });
  assert.equal(reply.res.status, 201, JSON.stringify(reply.json));

  const chat = await req(doctor, `/api/return-requests/${reqId}/messages`);
  assert.ok((chat.json.messages as { body: string }[]).some((m) => /Clínica Salute/.test(m.body)), "resposta do paciente deve chegar no chat do profissional");

  const pingChat = await req(doctor, "/api/notifications");
  const notesChat = (pingChat.json.notifications || []) as { type?: string; title?: string }[];
  assert.ok(notesChat.some((n) => n.type === "retorno_chat"), "médico deve ser notificado da mensagem do chat");

  const confirmed = await req(doctor, `/api/return-requests/${reqId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision: "confirm_return" }),
  });
  assert.equal(confirmed.res.status, 200, JSON.stringify(confirmed.json));
  assert.ok(["confirmed_return", "awaiting_payment"].includes(String(confirmed.json.request.status)), JSON.stringify(confirmed.json.request));
  assert.ok(confirmed.json.request.bookingId, "só reserva o horário depois da confirmação do profissional");

  const oldStart = new Date(Date.now() + 4 * 86_400_000);
  oldStart.setHours(18, 0, 0, 0);
  const old = await req(patient, "/api/return-requests", {
    method: "POST",
    body: JSON.stringify({
      professionalKind: "doctor",
      professionalId: carlos.id,
      slotStart: oldStart.toISOString(),
      alreadySeen: true,
      lastVisitApprox: "date",
      lastVisitWhen: "2026-08-01",
      lastVisitLocation: "Clínica Salute",
    }),
  });
  assert.equal(old.res.status, 201, JSON.stringify(old.json));
  const oldId = String(old.json.request.id);
  const refused = await req(doctor, `/api/return-requests/${oldId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision: "refuse_deadline" }),
  });
  assert.equal(refused.res.status, 200, JSON.stringify(refused.json));
  assert.equal(refused.json.request.status, "refused_deadline");
  const oldGet = await req(patient, `/api/return-requests/${oldId}`);
  assert.match(String(oldGet.json.request.autoMessage || ""), /mais de 30 dias/);
  const msgs = oldGet.json.messages as { body: string }[];
  assert.ok(msgs.some((m) => /nova consulta/.test(m.body)));

  const detailPage = await fetch(`${BASE}/paciente/retorno/${reqId}`, { headers: { cookie: patient.header() } });
  assert.ok(detailPage.ok, `detalhe paciente ${detailPage.status}`);
  const proPage = await fetch(`${BASE}/medicos/solicitacoes/${reqId}`, { headers: { cookie: doctor.header() } });
  assert.ok(proPage.ok, `detalhe médico ${proPage.status}`);

  console.log("return-requests-http ok", { reqId, oldId, doctor: carlos.id });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
