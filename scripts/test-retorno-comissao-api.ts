/**
 * E2E HTTP: retorno da equipe + cobrança da plataforma por profissional.
 * Usa o Next local em DEMO_URL (padrão http://127.0.0.1:3016) sem Supabase.
 */
import assert from "node:assert/strict";

const BASE = process.env.DEMO_URL || "http://127.0.0.1:3016";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "junoresidencia@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function cookieJar() {
  let cookie = "";
  return {
    header() {
      return cookie;
    },
    absorb(res: Response) {
      const raw = res.headers.getSetCookie?.() || [];
      const next = raw.map((c) => c.split(";")[0]).filter(Boolean);
      if (next.length) cookie = next.join("; ");
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
    json = { raw: text };
  }
  return { res, json };
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/admin/login`);
      if (r.ok) return;
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE}`);
}

async function main() {
  await waitReady();

  const admin = cookieJar();
  const login = await req(admin, "/api/admin/session", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(login.res.status, 200, `admin login ${login.res.status} ${JSON.stringify(login.json)}`);

  const allied = await req(admin, "/api/admin/allied");
  assert.equal(allied.res.status, 200);
  const pros = (allied.json.professionals as Array<Record<string, unknown>>) || [];
  const ana = pros.find((p) => p.email === "ana.psico@meurim.com");
  const rita = pros.find((p) => p.email === "rita.enf@meurim.com");
  assert.ok(ana, "Ana demo precisa existir");
  assert.ok(rita, "Rita demo precisa existir");

  const anaFee = await req(admin, "/api/admin/allied", {
    method: "PATCH",
    body: JSON.stringify({
      id: ana.id,
      appFeeMode: "por_atendimento",
      commissionPercent: 10,
      entryFee: 5,
    }),
  });
  assert.equal(anaFee.res.status, 200, `ana fee ${JSON.stringify(anaFee.json)}`);

  const ritaFee = await req(admin, "/api/admin/allied", {
    method: "PATCH",
    body: JSON.stringify({ id: rita.id, appFeeMode: "gratis", commissionPercent: 0, entryFee: 0 }),
  });
  assert.equal(ritaFee.res.status, 200);

  const nuts = await req(admin, "/api/admin/nutritionists");
  assert.equal(nuts.res.status, 200);
  const lia = ((nuts.json.nutritionists as Array<Record<string, unknown>>) || []).find(
    (n) => n.email === "lia.nutri@meurim.com"
  );
  assert.ok(lia, "Lia demo precisa existir");
  const liaFee = await req(admin, "/api/admin/nutritionists", {
    method: "PATCH",
    body: JSON.stringify({ id: lia.id, appFeeMode: "por_entrada", commissionPercent: 0, entryFee: 8 }),
  });
  assert.equal(liaFee.res.status, 200, `lia fee ${JSON.stringify(liaFee.json)}`);

  const alliedAfter = await req(admin, "/api/admin/allied");
  const anaAfter = ((alliedAfter.json.professionals as Array<Record<string, unknown>>) || []).find(
    (p) => p.id === ana.id
  )!;
  assert.equal(anaAfter.appFeeMode, "por_atendimento");
  assert.equal(anaAfter.commissionPercent, 10);
  assert.equal(anaAfter.entryFeeCents, 500);

  const anaJar = cookieJar();
  const anaLogin = await req(anaJar, "/api/allied/session", {
    method: "POST",
    body: JSON.stringify({ role: "psychology", identifier: "ana.psico@meurim.com", password: "123456" }),
  });
  assert.equal(anaLogin.res.status, 200, `ana login ${JSON.stringify(anaLogin.json)}`);

  const settings = await req(anaJar, "/api/allied/settings", {
    method: "PUT",
    body: JSON.stringify({
      consultationPrice: 150,
      returnPrice: 0,
      pixProfile: {
        keyType: "email",
        key: "ana.psico@pix.meurim.com",
        holderName: "Ana Psicologia",
        city: "Salvador",
      },
    }),
  });
  assert.equal(settings.res.status, 200, `ana settings ${JSON.stringify(settings.json)}`);

  const returnRoom = await req(anaJar, "/api/care-rooms", {
    method: "POST",
    body: JSON.stringify({ patientKey: "maria.prestacao@example.com", isReturn: true }),
  });
  assert.equal(returnRoom.res.status, 200, `return room ${JSON.stringify(returnRoom.json)}`);
  assert.equal(returnRoom.json.isReturn, true);
  assert.equal(returnRoom.json.priceCents, 0);
  assert.equal(returnRoom.json.paymentStatus, "free");

  const consultRoom = await req(anaJar, "/api/care-rooms", {
    method: "POST",
    body: JSON.stringify({ patientKey: "maria.prestacao@example.com", isReturn: false }),
  });
  assert.equal(consultRoom.res.status, 200, `consult room ${JSON.stringify(consultRoom.json)}`);
  assert.equal(consultRoom.json.isReturn, false);
  assert.equal(consultRoom.json.priceCents, 15000);
  assert.match(String(consultRoom.json.pixHolderName || ""), /Ana/i);

  const fee = await req(anaJar, "/api/allied/platform-fee");
  assert.equal(fee.res.status, 200, `platform-fee ${JSON.stringify(fee.json)}`);
  const rule = fee.json.rule as { appFeeMode: string; commissionPercent: number; entryFeeCents: number };
  assert.equal(rule.appFeeMode, "por_atendimento");
  assert.equal(rule.commissionPercent, 10);
  assert.match(String(fee.json.summary), /10%/);
  const totals = fee.json.totals as { dueCents: number };
  assert.ok(totals.dueCents >= 500, `retorno grátis ainda gera R$ 5 fixos, due=${totals.dueCents}`);
  const pix = fee.json.pix as { brCode?: string; amountCents?: number } | null;
  assert.ok(pix?.brCode, "QR/Pix da plataforma precisa existir quando há valor em aberto");
  assert.match(pix!.brCode!, /junoresidencia@gmail\.com/);

  const liaJar = cookieJar();
  const liaLogin = await req(liaJar, "/api/nutricionista/session", {
    method: "POST",
    body: JSON.stringify({ identifier: "lia.nutri@meurim.com", password: "123456" }),
  });
  assert.equal(liaLogin.res.status, 200, `lia login ${JSON.stringify(liaLogin.json)}`);
  const liaFeePanel = await req(liaJar, "/api/nutricionista/platform-fee");
  assert.equal(liaFeePanel.res.status, 200);
  const liaRule = liaFeePanel.json.rule as { appFeeMode: string; entryFeeCents: number };
  assert.equal(liaRule.appFeeMode, "por_entrada");
  assert.equal(liaRule.entryFeeCents, 800);
  const liaCharges = (liaFeePanel.json.charges as Array<Record<string, unknown>>) || [];
  const liaEntrada = liaCharges.find((c) => c.kind === "entrada");
  assert.ok(liaEntrada, "login da Lia deve gerar cobrança de entrada");
  assert.equal(liaEntrada.amountCents, 800);
  const liaTotals = liaFeePanel.json.totals as { dueCents: number };
  if (liaTotals.dueCents > 0) {
    const liaPix = liaFeePanel.json.pix as { brCode?: string } | null;
    assert.ok(liaPix?.brCode);
    assert.match(liaPix!.brCode!, /junoresidencia@gmail\.com/);
  }

  const docs = await req(admin, "/api/admin/doctors");
  assert.equal(docs.res.status, 200);
  const carlos = ((docs.json.doctors as Array<Record<string, unknown>>) || []).find(
    (d) => String(d.email || "").toLowerCase() === "carlos@meurim.com"
  );
  assert.ok(carlos, "Carlos demo precisa existir");
  const carlosFee = await req(admin, "/api/admin/doctors", {
    method: "PATCH",
    body: JSON.stringify({
      id: carlos.id,
      appFeeMode: "por_atendimento",
      platformPercent: 15,
      entryFee: 0,
    }),
  });
  assert.equal(carlosFee.res.status, 200, `carlos fee ${JSON.stringify(carlosFee.json)}`);

  const carlosJar = cookieJar();
  const carlosLogin = await req(carlosJar, "/api/auth", {
    method: "POST",
    body: JSON.stringify({ email: "carlos@meurim.com", password: "medico123" }),
  });
  assert.equal(carlosLogin.res.status, 200, `carlos login ${JSON.stringify(carlosLogin.json)}`);
  const carlosPanel = await req(carlosJar, "/api/doctor/platform-fee");
  assert.equal(carlosPanel.res.status, 200, `carlos fee panel ${JSON.stringify(carlosPanel.json)}`);
  const carlosRule = carlosPanel.json.rule as { appFeeMode: string; commissionPercent: number };
  assert.equal(carlosRule.appFeeMode, "por_atendimento");
  assert.equal(carlosRule.commissionPercent, 15);
  assert.match(String(carlosPanel.json.summary), /15%/);

  const charges = await req(admin, "/api/admin/platform-charges");
  assert.equal(charges.res.status, 200);
  const list = (charges.json.charges as Array<Record<string, unknown>>) || [];
  assert.ok(list.some((c) => c.professionalName === "Ana Psicologia" && c.kind === "atendimento"));
  assert.ok(list.some((c) => c.professionalName === "Lia Nutrição" && c.kind === "entrada"));
  const dest = charges.json.pix as { key?: string; adminEmail?: string };
  assert.equal(dest.key, "junoresidencia@gmail.com");
  assert.equal(dest.adminEmail, "junoresidencia@gmail.com");

  const liaOpen = list.find((c) => c.professionalName === "Lia Nutrição" && c.kind === "entrada");
  assert.ok(liaOpen);
  if (liaOpen.status !== "received") {
    const mark = await req(admin, "/api/admin/platform-charges", {
      method: "PATCH",
      body: JSON.stringify({ id: liaOpen.id, status: "received" }),
    });
    assert.equal(mark.res.status, 200);
  }

  console.log("retorno + comissão API ok", {
    anaDue: totals.dueCents,
    liaDueBeforeMark: liaTotals.dueCents,
    carlosRule: carlosRule.appFeeMode + " " + carlosRule.commissionPercent + "%",
    dest: dest.key,
    rooms: { return: returnRoom.json.meetingRoomId, consult: consultRoom.json.meetingRoomId },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
