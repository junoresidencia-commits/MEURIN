/**
 * E2E: médico, nutri, psico e enfermagem abrem consulta e retorno.
 * Cobre a chave remapeada (pid → e-mail) que quebrava o botão da sala.
 */
import assert from "node:assert/strict";

const BASE = process.env.DEMO_URL || "http://127.0.0.1:3017";

function cookieJar() {
  let cookie = "";
  return {
    header() {
      return cookie;
    },
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
    headers: {
      "Content-Type": "application/json",
      cookie: jar.header(),
      ...(init?.headers || {}),
    },
  });
  jar.absorb(res);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { res, json };
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/medicos/login`);
      if (r.ok || r.status === 307) return;
    } catch {
      /* booting */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE}`);
}

async function openRoom(jar: ReturnType<typeof cookieJar>, patientKey: string, isReturn: boolean, label: string) {
  const opened = await req(jar, "/api/care-rooms", {
    method: "POST",
    body: JSON.stringify({ patientKey, isReturn }),
  });
  assert.equal(opened.res.status, 200, `${label} ${opened.res.status} ${JSON.stringify(opened.json)}`);
  assert.ok(opened.json.meetingRoomId, `${label} sem meetingRoomId`);
  if (isReturn) assert.equal(opened.json.isReturn, true, `${label} deveria ser retorno`);
  return String(opened.json.meetingRoomId);
}

async function assertRoomEntry(hostJar: ReturnType<typeof cookieJar>, roomId: string, label: string) {
  const host = await req(hostJar, `/api/rooms/${roomId}`);
  assert.equal(host.res.status, 200, `${label} host ${host.res.status} ${JSON.stringify(host.json)}`);
  assert.equal(host.json.you?.role, "doctor", `${label} profissional deveria entrar como anfitrião`);
  assert.equal(host.json.booking?.meetingRoomId, roomId);

  const guest = cookieJar();
  const link = await req(guest, `/api/rooms/${roomId}?como=paciente`);
  assert.equal(link.res.status, 200, `${label} link ${link.res.status} ${JSON.stringify(link.json)}`);
  assert.equal(link.json.you?.role, "patient", `${label} link do paciente deveria entrar como paciente`);
  assert.equal(link.json.booking?.meetingRoomId, roomId);

  const page = await fetch(`${BASE}/consulta/${roomId}?como=paciente`);
  assert.ok(page.ok, `${label} página /consulta/${roomId} ${page.status}`);
  const html = await page.text();
  assert.match(html, /consulta/i, `${label} página da consulta vazia`);
}

async function main() {
  await waitReady();
  const stamp = Date.now().toString(36);
  const doctor = cookieJar();
  const login = await req(doctor, "/api/auth", {
    method: "POST",
    body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }),
  });
  assert.equal(login.res.status, 200, `login médico ${JSON.stringify(login.json)}`);

  const created = await req(doctor, "/api/doctor/patients", {
    method: "POST",
    body: JSON.stringify({
      name: `Iolanda Sala ${stamp}`,
      email: `iolanda.sala.${stamp}@example.com`,
      phone: "77999990001",
      birthdate: "1990-05-12",
      sex: "feminino",
      address: "Irecê",
      force: true,
    }),
  });
  assert.ok(created.res.ok, `criar paciente ${created.res.status} ${JSON.stringify(created.json)}`);
  const patientId = String(created.json.id || "");
  const email = `iolanda.sala.${stamp}@example.com`;
  const pid = patientId ? `pid:${patientId}` : email;

  const docConsult = await openRoom(doctor, email, false, "médico consulta e-mail");
  const docReturn = await openRoom(doctor, pid, true, "médico retorno pid");
  await assertRoomEntry(doctor, docConsult, "médico consulta");
  await assertRoomEntry(doctor, docReturn, "médico retorno");

  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  const { createAlliedProfessional, upsertAlliedLink, addAlliedReferral, updateAlliedSettings } = await import("../src/lib/allied-store");
  const { createNutritionist, upsertNutritionLink, addReferral, updateNutritionistStatus, updateNutritionistSettings } = await import("../src/lib/nutritionists-store");

  const resolvedDoctorId = String((login.json.doctor as { id?: string } | undefined)?.id || "");
  assert.ok(resolvedDoctorId, "Carlos precisa existir");

  const psycho = await createAlliedProfessional({
    role: "psychology",
    name: `Ana Sala ${stamp}`,
    email: `ana.sala.${stamp}@meurim.com`,
    password: "123456",
    status: "active",
  });
  const nurse = await createAlliedProfessional({
    role: "nursing",
    name: `Rita Sala ${stamp}`,
    email: `rita.sala.${stamp}@meurim.com`,
    password: "123456",
    status: "active",
  });
  await upsertAlliedLink(psycho.id, resolvedDoctorId);
  await upsertAlliedLink(nurse.id, resolvedDoctorId);
  await addAlliedReferral({
    role: "psychology",
    doctorId: resolvedDoctorId,
    professionalId: psycho.id,
    patientKey: pid,
    patientName: `Iolanda Sala ${stamp}`,
    reason: "Acompanhamento",
  });
  await addAlliedReferral({
    role: "nursing",
    doctorId: resolvedDoctorId,
    professionalId: nurse.id,
    patientKey: pid,
    patientName: `Iolanda Sala ${stamp}`,
    reason: "Cuidados",
  });
  await updateAlliedSettings(psycho.id, {
    consultationPriceCents: 0,
    returnPriceCents: 0,
    pixProfile: { keyType: "email", key: `ana.sala.${stamp}@pix.meurim.com` },
  });
  await updateAlliedSettings(nurse.id, {
    consultationPriceCents: 0,
    returnPriceCents: 0,
    pixProfile: { keyType: "email", key: `rita.sala.${stamp}@pix.meurim.com` },
  });

  const nut = await createNutritionist({
    name: `Lia Sala ${stamp}`,
    email: `lia.sala.${stamp}@meurim.com`,
    password: "123456",
    status: "active",
  });
  await updateNutritionistStatus(nut.id, "active");
  await upsertNutritionLink(nut.id, resolvedDoctorId);
  await addReferral({
    doctorId: resolvedDoctorId,
    nutritionistId: nut.id,
    patientKey: pid,
    patientName: `Iolanda Sala ${stamp}`,
    priority: "normal",
  });
  await updateNutritionistSettings(nut.id, {
    consultationPriceCents: 0,
    returnPriceCents: 0,
    pixProfile: { keyType: "email", key: `lia.sala.${stamp}@pix.meurim.com` },
  });

  const psychoJar = cookieJar();
  const psychoLogin = await req(psychoJar, "/api/allied/session", {
    method: "POST",
    body: JSON.stringify({ role: "psychology", identifier: `ana.sala.${stamp}@meurim.com`, password: "123456" }),
  });
  assert.equal(psychoLogin.res.status, 200, `psico login ${JSON.stringify(psychoLogin.json)}`);
  const psychoConsult = await openRoom(psychoJar, email, false, "psico consulta e-mail (referral era pid)");
  const psychoReturn = await openRoom(psychoJar, pid, true, "psico retorno pid");
  await assertRoomEntry(psychoJar, psychoConsult, "psico consulta");
  await assertRoomEntry(psychoJar, psychoReturn, "psico retorno");

  const nurseJar = cookieJar();
  const nurseLogin = await req(nurseJar, "/api/allied/session", {
    method: "POST",
    body: JSON.stringify({ role: "nursing", identifier: `rita.sala.${stamp}@meurim.com`, password: "123456" }),
  });
  assert.equal(nurseLogin.res.status, 200, `enf login ${JSON.stringify(nurseLogin.json)}`);
  const nurseConsult = await openRoom(nurseJar, email, false, "enfermagem consulta e-mail");
  const nurseReturn = await openRoom(nurseJar, pid, true, "enfermagem retorno pid");
  await assertRoomEntry(nurseJar, nurseConsult, "enfermagem consulta");
  await assertRoomEntry(nurseJar, nurseReturn, "enfermagem retorno");

  const nutJar = cookieJar();
  const nutLogin = await req(nutJar, "/api/nutricionista/session", {
    method: "POST",
    body: JSON.stringify({ identifier: `lia.sala.${stamp}@meurim.com`, password: "123456" }),
  });
  assert.equal(nutLogin.res.status, 200, `nutri login ${JSON.stringify(nutLogin.json)}`);
  const nutConsult = await openRoom(nutJar, email, false, "nutri consulta e-mail");
  const nutReturn = await openRoom(nutJar, pid, true, "nutri retorno pid");
  await assertRoomEntry(nutJar, nutConsult, "nutri consulta");
  await assertRoomEntry(nutJar, nutReturn, "nutri retorno");

  console.log("abrir sala + entrada + link ok", {
    email,
    pid,
    docConsult,
    psychoConsult,
    nurseConsult,
    nutConsult,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
