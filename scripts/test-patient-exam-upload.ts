/**
 * Exames do paciente: PDF/foto até 50 MB, MIME flexível, caminho assinado.
 */
import assert from "node:assert/strict";
import {
  EXAM_MAX_BYTES,
  EXAM_MAX_LABEL,
  examPathBelongsToPatient,
  formatBytes,
  inspectExamFile,
} from "../src/lib/patient-exam-file";

const BASE = process.env.DEMO_URL || "http://127.0.0.1:3021";

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
  const headers = new Headers(init?.headers);
  if (!headers.has("cookie")) headers.set("cookie", jar.header());
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  jar.absorb(res);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text.slice(0, 240) };
  }
  return { res, json };
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/paciente/exames`);
      if (r.ok || r.status === 307 || r.status === 200) return;
    } catch {
      /* boot */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE}`);
}

function unitTests() {
  const pdfOk = inspectExamFile({ name: "laudo.pdf", type: "", size: 20 * 1024 * 1024 });
  assert.equal(pdfOk.ok, true);
  if (pdfOk.ok) assert.equal(pdfOk.mime, "application/pdf");

  const octet = inspectExamFile({
    name: "exame laboratorial.pdf",
    type: "application/octet-stream",
    size: 18 * 1024 * 1024,
  });
  assert.equal(octet.ok, true);
  if (octet.ok) assert.equal(octet.mime, "application/pdf");

  const jpeg = inspectExamFile({ name: "foto.JPG", type: "image/jpg", size: 8 * 1024 * 1024 });
  assert.equal(jpeg.ok, true);
  if (jpeg.ok) assert.equal(jpeg.mime, "image/jpeg");

  const heic = inspectExamFile({ name: "IMG_1234.HEIC", type: "", size: 6 * 1024 * 1024 });
  assert.equal(heic.ok, true);

  const tooBig = inspectExamFile({ name: "grande.pdf", type: "application/pdf", size: EXAM_MAX_BYTES + 1 });
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.match(tooBig.error, /50 MB/);

  const oldLimit = inspectExamFile({ name: "antes-quebrava.pdf", type: "application/pdf", size: 16 * 1024 * 1024 });
  assert.equal(oldLimit.ok, true, "16 MB precisa passar (antes o teto era 15 MB)");

  const empty = inspectExamFile({ name: "vazio.pdf", type: "application/pdf", size: 0 });
  assert.equal(empty.ok, false);

  const exe = inspectExamFile({ name: "malware.exe", type: "application/x-msdownload", size: 1000 });
  assert.equal(exe.ok, false);

  assert.equal(examPathBelongsToPatient("a@b.com/uuid-laudo.pdf", "a@b.com"), true);
  assert.equal(examPathBelongsToPatient("outro@b.com/uuid-laudo.pdf", "a@b.com"), false);
  assert.equal(examPathBelongsToPatient("a@b.com/../x.pdf", "a@b.com"), false);
  assert.equal(formatBytes(20 * 1024 * 1024), "20,0 MB");
  assert.equal(EXAM_MAX_LABEL, "50 MB");
  console.log("unit: pdf/imagem até 50 MB ok");
}

async function apiTests() {
  await waitReady();
  const jar = cookieJar();
  const login = await req(jar, "/api/patient/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "paciente.exame@meurim.com" }),
  });
  assert.equal(login.res.status, 200, JSON.stringify(login.json));

  const huge = await req(jar, "/api/patient/exams/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "grande.pdf", type: "application/pdf", size: 60 * 1024 * 1024 }),
  });
  assert.equal(huge.res.status, 400);
  assert.match(String(huge.json.error || ""), /50 MB/);

  const oldWouldFail = await req(jar, "/api/patient/exams/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "laudo.pdf", type: "", size: 16 * 1024 * 1024 }),
  });
  assert.notEqual(oldWouldFail.res.status, 400, `16 MB não pode ser recusado por tamanho: ${JSON.stringify(oldWouldFail.json)}`);
  assert.ok(
    oldWouldFail.res.status === 200 || oldWouldFail.res.status === 503,
    `esperado 200 (storage) ou 503 (sem supabase), veio ${oldWouldFail.res.status} ${JSON.stringify(oldWouldFail.json)}`
  );
  if (oldWouldFail.res.status === 200) {
    assert.ok(oldWouldFail.json.signedUrl, "sign deveria devolver signedUrl");
    assert.ok(oldWouldFail.json.path);

    const sixMb = 6 * 1024 * 1024;
    const signBig = await req(jar, "/api/patient/exams/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "laudo-6mb.pdf", type: "application/octet-stream", size: sixMb }),
    });
    assert.equal(signBig.res.status, 200, JSON.stringify(signBig.json));
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
      Buffer.alloc(sixMb - 64, 0x20),
    ]).subarray(0, sixMb);
    const putHeaders: Record<string, string> = { "Content-Type": "application/pdf" };
    if (typeof signBig.json.token === "string" && signBig.json.token) {
      putHeaders.Authorization = `Bearer ${signBig.json.token}`;
    }
    const put = await fetch(String(signBig.json.signedUrl), { method: "PUT", headers: putHeaders, body: pdf });
    assert.ok(put.ok, `PUT storage ${put.status} ${await put.text().catch(() => "")}`);
    const done = await req(jar, "/api/patient/exams/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: signBig.json.path,
        name: "laudo-6mb.pdf",
        mime: "application/pdf",
        size: sixMb,
        category: "Laudo",
      }),
    });
    assert.equal(done.res.status, 201, JSON.stringify(done.json));
    const listed = await req(jar, "/api/patient/exams");
    const uploads = (listed.json.uploads as Array<{ name?: string; sizeBytes?: number }>) || [];
    assert.ok(uploads.some((u) => u.name === "laudo-6mb.pdf" && u.sizeBytes === sixMb), "lista deveria trazer o PDF de 6 MB");
    console.log("api: PDF 6 MB enviado direto ao Storage");
  }

  const page = await fetch(`${BASE}/paciente/exames`, { headers: { cookie: jar.header() } });
  assert.ok(page.ok || page.status === 200);
  const html = await page.text();
  assert.match(html, /50 MB/, "a página do paciente deve mostrar o teto de 50 MB");

  console.log("api: teto 50 MB e PDF sem MIME ok", { signStatus: oldWouldFail.res.status });
}

async function main() {
  unitTests();
  if (process.env.SKIP_HTTP === "1") return;
  await apiTests();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
