/**
 * Perfil: foto + dados profissionais da equipe.
 */
import assert from "node:assert/strict";

const BASE = process.env.DEMO_URL || "http://127.0.0.1:3017";
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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
      const r = await fetch(`${BASE}/psicologo/login`);
      if (r.ok) return;
    } catch { /* boot */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE}`);
}

async function main() {
  await waitReady();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  const { createAlliedProfessional } = await import("../src/lib/allied-store");
  const stamp = Date.now().toString(36);
  const email = `perfil.${stamp}@meurim.com`;
  await createAlliedProfessional({
    role: "psychology",
    name: `Lud Perfil ${stamp}`,
    email,
    password: "123456",
    status: "active",
    registry: "33772",
    uf: "BA",
  });

  const jar = cookieJar();
  const login = await req(jar, "/api/allied/session", {
    method: "POST",
    body: JSON.stringify({ role: "psychology", identifier: email, password: "123456" }),
  });
  assert.equal(login.res.status, 200, JSON.stringify(login.json));

  const before = await req(jar, "/api/allied/settings");
  assert.equal(before.res.status, 200);
  assert.ok(!before.json.photoUrl);

  const photo = await req(jar, "/api/allied/photo", {
    method: "POST",
    body: JSON.stringify({ photo: TINY_PNG }),
  });
  assert.equal(photo.res.status, 200, JSON.stringify(photo.json));
  assert.ok(String(photo.json.photoUrl || "").startsWith("data:image/png"));

  const saved = await req(jar, "/api/allied/settings", {
    method: "PUT",
    body: JSON.stringify({
      name: "Ludmila Perfil",
      city: "Irecê",
      uf: "BA",
      specialty: "Psicologia clínica",
      bio: "Atendimento online.",
      registry: "33772",
      phone: "77999990000",
      consultationPrice: 0,
      returnPrice: 0,
    }),
  });
  assert.equal(saved.res.status, 200, JSON.stringify(saved.json));

  const after = await req(jar, "/api/allied/settings");
  assert.equal(after.json.name, "Ludmila Perfil");
  assert.equal(after.json.city, "Irecê");
  assert.equal(after.json.specialty, "Psicologia clínica");
  assert.ok(after.json.photoUrl);

  const me = await req(jar, "/api/allied/me");
  assert.equal(me.json.professional.name, "Ludmila Perfil");
  assert.ok(me.json.professional.photoUrl);

  console.log("perfil profissional ok", { email, name: after.json.name, city: after.json.city });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
