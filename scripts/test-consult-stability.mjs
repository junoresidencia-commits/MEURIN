/**
 * Estabilidade da teleconsulta: duas abas, queda de rede, reconexão.
 * DEMO_URL=http://127.0.0.1:3020 CONSULT_ROOM=... npx tsx scripts/test-consult-stability.mjs
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = process.env.DEMO_URL || process.env.CONSULT_BASE || "http://127.0.0.1:3020";
const ROOM = process.env.CONSULT_ROOM || "b1771d07-4ce8-4ee6-b659-0f82c5548f72";
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

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function waitText(page, needle, ms = 25000) {
  const started = Date.now();
  const re = new RegExp(needle, "i");
  while (Date.now() - started < ms) {
    if (re.test(await bodyText(page))) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`texto ausente: ${needle}\n${(await bodyText(page)).slice(0, 800)}`);
}

async function emulate(page, opts) {
  const client = await page.createCDPSession();
  await client.send("Network.emulateNetworkConditions", {
    offline: Boolean(opts.offline),
    latency: opts.latency ?? 0,
    downloadThroughput: opts.download ?? -1,
    uploadThroughput: opts.upload ?? -1,
    connectionType: opts.type || "none",
  });
}

async function main() {
  await mkdir(ART, { recursive: true });
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
  doctor.setDefaultTimeout(45000);
  patient.setDefaultTimeout(45000);
  await doctor.setViewport({ width: 1280, height: 800 });
  await patient.setViewport({ width: 1280, height: 800 });

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

  await waitText(doctor, "Entrar para atender");
  await waitText(patient, "Você é o paciente|Entrar na consulta");
  await clickText(doctor, "Entrar para atender");
  await clickText(patient, "Entrar na consulta");
  await waitText(doctor, "Aguardando|Cruzando|Conectado|Paciente|Conexão");
  await new Promise((r) => setTimeout(r, 6000));
  await doctor.screenshot({ path: `${ART}/consult_stability_wifi_bom.png`, fullPage: true });

  const beforeOffline = await bodyText(doctor);
  assert.equal(/erro na chamada/i.test(beforeOffline), false);

  await emulate(patient, { offline: true, type: "none" });
  await new Promise((r) => setTimeout(r, 12000));
  await doctor.screenshot({ path: `${ART}/consult_stability_queda.png`, fullPage: true });
  const during = `${await bodyText(doctor)}\n${await bodyText(patient)}`;
  assert.equal(/erro na chamada/i.test(during), false);
  assert.equal(/sair da consulta/i.test(during), true, "consulta permanece aberta");
  assert.ok(/Conexão interrompida|Tentando reconectar|Conexão boa|Conexão instável|Conexão ruim|Cruzando|Conectado|Consulta online/i.test(during));

  await emulate(patient, { offline: false, latency: 80, download: 1_500_000, upload: 750_000, type: "wifi" });
  await new Promise((r) => setTimeout(r, 8000));
  await doctor.screenshot({ path: `${ART}/consult_stability_reconectou.png`, fullPage: true });
  const after = `${await bodyText(doctor)}\n${await bodyText(patient)}`;
  assert.equal(/erro na chamada/i.test(after), false);
  assert.ok(/Consulta online/.test(after));
  assert.ok(/Prontuário|prontuário|Evolução|evolução|Entrar|Conectado|Conexão|Aguardando|Cruzando/.test(after));

  await emulate(patient, { offline: false, latency: 400, download: 80_000, upload: 40_000, type: "cellular3g" });
  await new Promise((r) => setTimeout(r, 3000));
  await doctor.screenshot({ path: `${ART}/consult_stability_banda_baixa.png`, fullPage: true });
  const slow = `${await bodyText(doctor)}\n${await bodyText(patient)}`;
  assert.equal(/erro na chamada/i.test(slow), false);

  await writeFile(
    `${ART}/consult_stability.json`,
    JSON.stringify(
      {
        room: ROOM,
        noGenericError: true,
        stayedInRoom: true,
      },
      null,
      2
    )
  );
  await browser.close();
  console.log("consult-stability ok", { room: ROOM });
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
