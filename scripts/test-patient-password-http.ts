/**
 * HTTP: criar senha no 1º acesso sem senha atual + sair da sessão.
 * Uso: DEMO_URL=http://127.0.0.1:3055 npm run check:patient-password-http
 */
import assert from "node:assert/strict";

const BASE = process.env.DEMO_URL || "http://127.0.0.1:3055";

function cookieJar() {
  let cookie = "";
  return {
    header() { return cookie; },
    absorb(res: Response) {
      const raw = res.headers.getSetCookie?.() || [];
      const next = raw.map((c) => c.split(";")[0]).filter(Boolean);
      if (next.length) cookie = [...new Set([...cookie.split("; ").filter(Boolean), ...next])].join("; ");
    },
    clear() { cookie = ""; },
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
      const r = await fetch(`${BASE}/paciente/senha?primeiro=1`);
      if (r.ok) return;
    } catch { /* boot */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE}`);
}

function cpfFromStamp(n: number) {
  const base = String(10000000000 + (n % 89999999999)).slice(0, 11);
  return base;
}

async function main() {
  await waitReady();
  const stamp = Date.now();
  const jar = cookieJar();
  const cpf = cpfFromStamp(stamp);
  const name = `Teste Senha ${stamp}`;

  const created = await req(jar, "/api/patient/register", {
    method: "POST",
    body: JSON.stringify({ name, cpf }),
  });
  assert.equal(created.res.status, 200, JSON.stringify(created.json));

  const me = await req(jar, "/api/patient/me");
  assert.equal(me.res.status, 200, JSON.stringify(me.json));
  assert.equal(me.json.mustChangePassword, true, "conta sem senha própria precisa criar senha");

  const blocked = await req(jar, "/api/patient/password", {
    method: "POST",
    body: JSON.stringify({ newPassword: "minhasenha8" }),
  });
  assert.notEqual(blocked.res.status, 401, `1º acesso não pode pedir senha atual: ${JSON.stringify(blocked.json)}`);
  assert.equal(blocked.res.status, 200, JSON.stringify(blocked.json));

  const meAfter = await req(jar, "/api/patient/me");
  assert.equal(meAfter.json.mustChangePassword, false);

  const login = cookieJar();
  const entered = await req(login, "/api/patient/session", {
    method: "POST",
    body: JSON.stringify({ cpf, password: "minhasenha8" }),
  });
  assert.equal(entered.res.status, 200, JSON.stringify(entered.json));
  assert.equal(entered.json.mustChangePassword, false);

  const wrong = await req(login, "/api/patient/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword: "errada123", newPassword: "outrasenha9" }),
  });
  assert.equal(wrong.res.status, 401, JSON.stringify(wrong.json));
  assert.match(String(wrong.json.error || ""), /senha atual/i);

  const firstAgain = await req(login, "/api/patient/password", {
    method: "POST",
    body: JSON.stringify({ firstAccess: true, newPassword: "outrasenha9" }),
  });
  assert.equal(firstAgain.res.status, 200, JSON.stringify(firstAgain.json));

  const stale = cookieJar();
  const cpfStale = cpfFromStamp(stamp + 7);
  const createdStale = await req(stale, "/api/patient/register", {
    method: "POST",
    body: JSON.stringify({ name: `Flag Ausente ${stamp}`, cpf: cpfStale, password: "123456" }),
  });
  assert.equal(createdStale.res.status, 200, JSON.stringify(createdStale.json));
  const staleMe = await req(stale, "/api/patient/me");
  assert.equal(staleMe.json.mustChangePassword, true, "123456 ainda conta como 1º acesso");
  const staleSet = await req(stale, "/api/patient/password", {
    method: "POST",
    body: JSON.stringify({ firstAccess: true, newPassword: "senhaoficial8" }),
  });
  assert.equal(staleSet.res.status, 200, `flag ausente + 123456: ${JSON.stringify(staleSet.json)}`);

  const sair = await req(login, "/api/patient/session", { method: "DELETE" });
  assert.equal(sair.res.status, 200, JSON.stringify(sair.json));
  login.clear();
  const afterSair = await req(login, "/api/patient/me");
  assert.equal(afterSair.res.status, 401);

  const page = await fetch(`${BASE}/paciente/senha?primeiro=1`);
  const html = await page.text();
  assert.match(html, /Sair|sair/);
  assert.match(html, /Crie sua senha|Criar senha/);

  console.log("patient-password-http ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
