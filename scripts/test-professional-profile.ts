/**
 * Perfil: foto + dados em psicologia, enfermagem, nutrição e médico.
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

async function alliedPhotoAndProfile(role: "psychology" | "nursing", stamp: string) {
  const { createAlliedProfessional } = await import("../src/lib/allied-store");
  const email = `perfil.${role}.${stamp}@meurim.com`;
  await createAlliedProfessional({
    role,
    name: role === "psychology" ? `Lud Perfil ${stamp}` : `Rita Perfil ${stamp}`,
    email,
    password: "123456",
    status: "active",
    registry: role === "psychology" ? "33772" : "123456",
    uf: "BA",
  });
  const jar = cookieJar();
  const login = await req(jar, "/api/allied/session", {
    method: "POST",
    body: JSON.stringify({ role, identifier: email, password: "123456" }),
  });
  assert.equal(login.res.status, 200, JSON.stringify(login.json));
  const photo = await req(jar, "/api/allied/photo", { method: "POST", body: JSON.stringify({ photo: TINY_PNG }) });
  assert.equal(photo.res.status, 200, JSON.stringify(photo.json));
  const city = role === "psychology" ? "Irecê" : "Salvador";
  const specialty = role === "psychology" ? "Psicologia clínica" : "Enfermagem renal";
  const saved = await req(jar, "/api/allied/settings", {
    method: "PUT",
    body: JSON.stringify({
      name: role === "psychology" ? "Ludmila Perfil" : "Rita Perfil",
      city, uf: "BA", specialty, bio: "Atendimento online.",
      consultationPrice: 0, returnPrice: 0,
    }),
  });
  assert.equal(saved.res.status, 200, JSON.stringify(saved.json));
  const after = await req(jar, "/api/allied/settings");
  assert.equal(after.json.city, city);
  assert.equal(after.json.specialty, specialty);
  assert.ok(after.json.photoUrl);
  const me = await req(jar, "/api/allied/me");
  assert.ok(me.json.professional.photoUrl);
  return { role, email, city };
}

async function nutritionPhotoAndProfile(stamp: string) {
  const { createNutritionist } = await import("../src/lib/nutritionists-store");
  const email = `perfil.nutri.${stamp}@meurim.com`;
  await createNutritionist({
    name: `Lia Perfil ${stamp}`,
    email,
    password: "123456",
    status: "active",
    crn: "12345",
    uf: "BA",
  });
  const jar = cookieJar();
  const login = await req(jar, "/api/nutricionista/session", {
    method: "POST",
    body: JSON.stringify({ identifier: email, password: "123456" }),
  });
  assert.equal(login.res.status, 200, JSON.stringify(login.json));
  const photo = await req(jar, "/api/nutricionista/photo", { method: "POST", body: JSON.stringify({ photo: TINY_PNG }) });
  assert.equal(photo.res.status, 200, JSON.stringify(photo.json));
  const saved = await req(jar, "/api/nutricionista/settings", {
    method: "PUT",
    body: JSON.stringify({
      name: "Lia Perfil",
      city: "Feira de Santana",
      uf: "BA",
      specialty: "Nutrição renal",
      bio: "Planos alimentares.",
      consultationPrice: 0,
      returnPrice: 0,
    }),
  });
  assert.equal(saved.res.status, 200, JSON.stringify(saved.json));
  const after = await req(jar, "/api/nutricionista/settings");
  assert.equal(after.json.city, "Feira de Santana");
  assert.ok(after.json.photoUrl);
  const me = await req(jar, "/api/nutricionista/me");
  assert.ok(me.json.nutritionist.photoUrl);
  return { role: "nutrition", email, city: after.json.city };
}

async function doctorPhotoAndProfile() {
  const jar = cookieJar();
  const login = await req(jar, "/api/auth", {
    method: "POST",
    body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }),
  });
  assert.equal(login.res.status, 200, JSON.stringify(login.json));
  const photo = await req(jar, "/api/doctor/photo", { method: "POST", body: JSON.stringify({ photo: TINY_PNG }) });
  assert.equal(photo.res.status, 200, JSON.stringify(photo.json));
  const saved = await req(jar, "/api/doctor/profile", {
    method: "PUT",
    body: JSON.stringify({ city: "Salvador", specialty: "Nefrologia", bio: "Consulta renal." }),
  });
  assert.equal(saved.res.status, 200, JSON.stringify(saved.json));
  const after = await req(jar, "/api/doctor/profile");
  assert.equal(after.json.profile.city, "Salvador");
  assert.ok(after.json.profile.photoUrl);
  const me = await req(jar, "/api/auth");
  assert.ok(me.json.doctor.photoUrl);
  return { role: "doctor", email: "carlos@meurim.com", city: after.json.profile.city };
}

async function main() {
  await waitReady();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  const stamp = Date.now().toString(36);
  const results = [
    await alliedPhotoAndProfile("psychology", stamp),
    await alliedPhotoAndProfile("nursing", stamp),
    await nutritionPhotoAndProfile(stamp),
    await doctorPhotoAndProfile(),
  ];
  console.log("perfil profissional ok", results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
