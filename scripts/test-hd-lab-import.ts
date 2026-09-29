import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readDb } from "../src/lib/store";
import { parseHdLabsFromText } from "../src/lib/hd-lab-import";
import { extractLabFileText } from "../src/lib/hd-lab-file-text";
import { ensureHdSession, hdAddPatient, hdImportLabDocument, requireHd } from "../src/lib/hd-store";
import type { HdActor } from "../src/lib/hd-types";

const LAUDO = `
Laboratório Exemplo
Paciente: MARIA TESTE HD
Coleta: 15/09/2026

Hemoglobina 10,2 g/dL
Hematócrito 31 %
Fósforo 5,4 mg/dL
Potássio 5,1 mEq/L
PTH 480 pg/mL
Creatinina 8,4 mg/dL
Ureia pré 142 mg/dL
Ureia pós 48 mg/dL
Glicose 98 mg/dL
`;

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const parsed = parseHdLabsFromText(LAUDO, [{ id: "p1", name: "MARIA TESTE HD" }]);
  assert.equal(parsed.date, "2026-09-15");
  assert.equal(parsed.needsPatient, false);
  assert.equal(parsed.matched[0]?.id, "p1");
  const by = Object.fromEntries(parsed.items.map((i) => [i.examCode, i]));
  assert.equal(by.hb.value, "10,2");
  assert.equal(by.ht.value, "31");
  assert.equal(by.p.value, "5,4");
  assert.equal(by.k.value, "5,1");
  assert.equal(by.pth.value, "480");
  assert.equal(by.creat.value, "8,4");
  assert.equal(by.urea_pre.value, "142");
  assert.equal(by.urea_post.value, "48");
  assert.ok(!parsed.items.some((i) => /glicose|glicemia/i.test(i.exam)));

  const none = parseHdLabsFromText(LAUDO, [{ id: "p2", name: "JOAO OUTRO" }]);
  assert.equal(none.needsPatient, true);
  assert.ok(none.items.length >= 6);

  const empty = parseHdLabsFromText("receituário sem números de exame", [{ id: "p1", name: "MARIA TESTE HD" }]);
  assert.equal(empty.items.length, 0);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([420, 620]);
  let y = 590;
  for (const line of LAUDO.replace(/[^\x00-\x7F]/g, " ").split("\n")) {
    page.drawText(line.slice(0, 80), { x: 24, y, size: 10, font });
    y -= 14;
  }
  const pdfBuf = Buffer.from(await doc.save());
  const extracted = await extractLabFileText({ name: "laudo.pdf", type: "application/pdf", buffer: pdfBuf });
  assert.ok(extracted.text.toLowerCase().includes("hemoglobina") || extracted.text.toLowerCase().includes("10"), extracted.note || "pdf sem texto");
  const fromPdf = parseHdLabsFromText(extracted.text, [{ id: "p1", name: "MARIA TESTE HD" }]);
  assert.ok(fromPdf.items.some((i) => i.examCode === "hb" || i.examCode === "p" || i.examCode === "pth"), `pdf parse ${fromPdf.items.map((i) => i.examCode).join(",")}`);

  const hdFile = path.join(process.cwd(), "data", "hemodialise.json");
  try { unlinkSync(hdFile); } catch { /* ok */ }
  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos);
  const actor: HdActor = { doctorId: carlos.id, name: carlos.name, email: carlos.email, isSuperAdmin: false };
  await ensureHdSession(actor);
  const ctx = await requireHd(actor, "upload_exams");
  assert.ok(ctx);
  await hdAddPatient(ctx, { name: "MARIA TESTE HD" });
  const launched = await hdImportLabDocument(ctx, null, { year: 2026, month: 9, text: LAUDO });
  assert.ok(launched.created >= 6, `esperava lançar vários, veio ${launched.created}`);
  assert.equal(launched.needsPatient, false);
  assert.ok(launched.note && /Lancei/i.test(launched.note));

  console.log("ok hd-lab-import", { created: launched.created, pending: launched.pending, pdfItems: fromPdf.items.length });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
