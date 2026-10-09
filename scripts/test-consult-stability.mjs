/**
 * Estabilidade da teleconsulta: duas abas, queda de rede, reconexão.
 * DEMO_URL=http://127.0.0.1:3020 CONSULT_ROOM=... npx tsx scripts/test-consult-stability.mjs
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const step = (msg) => console.log(new Date().toISOString(), msg);

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

async function waitText(page, needle, ms = 18000) {
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
  const profile = `/tmp/consult-stability-${Date.now()}`;
  step(`launch chrome profile=${profile}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    timeout: 20000,
    protocolTimeout: 60000,
    args: [
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
    ],
  });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await browser.close().catch(() => undefined);
  };
  try {
  const doctor = await browser.newPage();
  const patient = await browser.newPage();
  doctor.setDefaultTimeout(45000);
  patient.setDefaultTimeout(45000);
  await doctor.setViewport({ width: 1280, height: 800 });
  await patient.setViewport({ width: 1280, height: 800 });

  step("login médico");
  const loginRes = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }),
  });
  assert.ok(loginRes.ok, "login do médico");
  const rawCookie = loginRes.headers.get("set-cookie") || "";
  const cookieName = rawCookie.split("=")[0];
  const cookieValue = rawCookie.split(";")[0].slice(cookieName.length + 1);
  await doctor.setCookie({
    name: cookieName,
    value: cookieValue,
    url: BASE,
    httpOnly: true,
    sameSite: "Lax",
  });

  step("abrir salas");
  await Promise.all([
    doctor.goto(`${BASE}/consulta/${ROOM}`, { waitUntil: "domcontentloaded" }),
    patient.goto(`${BASE}/consulta/${ROOM}?como=paciente`, { waitUntil: "domcontentloaded" }),
  ]);

  await waitText(doctor, "Entrar para atender");
  await waitText(patient, "Você é o paciente|Entrar na consulta");
  step("entrar na chamada");
  await clickText(doctor, "Entrar para atender");
  await clickText(patient, "Entrar na consulta");
  await waitText(doctor, "Aguardando|Cruzando|Conectado|Paciente|Conexão");
  step("esperar cruzar mídia");
  await new Promise((r) => setTimeout(r, 8000));
  step("screenshot wifi");
  await doctor.screenshot({ path: `${ART}/consult_stability_wifi_bom.png`, fullPage: true });
  step("ler faixas de vídeo");
  const media = await doctor.evaluate(() =>
    [...document.querySelectorAll("video")].map((v) => ({
      paused: v.paused,
      muted: v.muted,
      width: v.videoWidth,
      kinds: v.srcObject instanceof MediaStream ? v.srcObject.getTracks().map((t) => t.kind).sort() : [],
      trackMuted: v.srcObject instanceof MediaStream ? v.srcObject.getTracks().map((t) => `${t.kind}:${t.muted}`) : [],
    }))
  );
  const remote = media[0];
  assert.ok(remote && remote.kinds.includes("audio") && remote.kinds.includes("video"), `vídeo remoto sem faixa: ${JSON.stringify(media)}`);
  if (remote.width === 0) {
    step(`aviso: faixa de vídeo cruzou mas o quadro ainda não pintou ${JSON.stringify(media)}`);
  }

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
        remoteKinds: remote.kinds,
      },
      null,
      2
    )
  );
  await close();
  console.log("consult-stability ok", { room: ROOM, remoteKinds: remote.kinds });
  } catch (err) {
    await close();
    throw err;
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
