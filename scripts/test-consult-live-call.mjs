/**
 * Duas abas Chrome (mídia falsa) na mesma sala: médico e paciente.
 */
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = process.env.CONSULT_BASE || "http://127.0.0.1:3066";
const ROOM = process.env.CONSULT_ROOM || "bb380928-a49d-4d4e-9b23-2f3105ad9935";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const ART = "/opt/cursor/artifacts";

async function clickText(page, needle) {
  const clicked = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes(text));
    if (!btn) return false;
    btn.click();
    return true;
  }, needle);
  assert.ok(clicked, `botão "${needle}"`);
}

async function waitText(page, needle, ms = 20000) {
  const started = Date.now();
  const re = new RegExp(needle, "i");
  while (Date.now() - started < ms) {
    const t = await page.evaluate(() => document.body.innerText);
    if (re.test(t)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`texto ausente: ${needle}`);
}

async function main() {
  await mkdir(ART, { recursive: true });

  const sensitive = await fetch(`${BASE}/api/consult-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: ROOM, role: "doctor", kind: "join", sdp: "v=0 reject me" }),
  });
  assert.equal(sensitive.status, 400, "SDP não pode ir para telemetria");

  const okEv = await fetch(`${BASE}/api/consult-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: ROOM, role: "doctor", kind: "join", browser: "chrome" }),
  });
  assert.equal(okEv.status, 200);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });

  const doctor = await browser.newPage();
  const patient = await browser.newPage();
  doctor.setDefaultTimeout(40000);
  patient.setDefaultTimeout(40000);

  await doctor.goto(`${BASE}/medicos/login`, { waitUntil: "domcontentloaded" });
  const login = await doctor.evaluate(async (base) => {
    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }),
    });
    return res.ok;
  }, BASE);
  assert.ok(login, "login do médico");

  await Promise.all([
    doctor.goto(`${BASE}/consulta/${ROOM}`, { waitUntil: "domcontentloaded" }),
    patient.goto(`${BASE}/consulta/${ROOM}?como=paciente`, { waitUntil: "domcontentloaded" }),
  ]);

  try {
    await waitText(doctor, "Entrar para atender");
    await waitText(patient, "Você é o paciente");
  } catch (err) {
    const dt = await doctor.evaluate(() => document.body.innerText);
    const pt = await patient.evaluate(() => document.body.innerText);
    await doctor.screenshot({ path: `${ART}/consult_doctor_fail.png`, fullPage: true }).catch(() => {});
    await patient.screenshot({ path: `${ART}/consult_patient_fail.png`, fullPage: true }).catch(() => {});
    throw new Error(`lobby falhou.\nMEDICO:\n${dt.slice(0, 800)}\nPACIENTE:\n${pt.slice(0, 800)}\n${err}`);
  }
  await doctor.screenshot({ path: `${ART}/consult_doctor_lobby.png`, fullPage: true });
  await patient.screenshot({ path: `${ART}/consult_patient_lobby.png`, fullPage: true });

  await clickText(doctor, "Entrar para atender");
  await clickText(patient, "Entrar na consulta");
  await waitText(doctor, "Aguardando|Cruzando|Conectado|Paciente");
  await waitText(patient, "Aguardando|Cruzando|Conectado|Câmera ligada");
  await new Promise((r) => setTimeout(r, 4000));
  await doctor.screenshot({ path: `${ART}/consult_doctor_in_call.png`, fullPage: true });
  await patient.screenshot({ path: `${ART}/consult_patient_in_call.png`, fullPage: true });

  const sig = await fetch(`${BASE}/api/signaling?roomId=${ROOM}`).then((r) => r.json());
  const types = (sig.messages || []).map((m) => m.type);
  await writeFile(
    `${ART}/consult_signaling_types.json`,
    JSON.stringify({ types, count: types.length, hasOffer: types.includes("offer"), hasAnswer: types.includes("answer") }, null, 2)
  );

  const doctorText = await doctor.evaluate(() => document.body.innerText);
  const patientText = await patient.evaluate(() => document.body.innerText);
  await browser.close();

  assert.ok(types.includes("join") || types.includes("offer") || types.includes("ice"), "houve sinalização");
  assert.ok(doctorText.includes("Consulta online"));
  assert.ok(patientText.includes("Consulta online"));
  console.log("consult-live-call ok", { types, doctorHasChart: /Prontuário|prontuário/.test(doctorText) });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
