import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BUILTIN_TEMPLATES } from "../src/lib/document-templates";
import { winAnsiSafe } from "../src/lib/pdf-winansi";

function extractPdfLatin1(bytes: Uint8Array): string {
  const data = Buffer.from(bytes);
  const chunks: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(data.toString("latin1")))) {
    const raw = Buffer.from(m[1], "latin1");
    let decoded = raw;
    try { decoded = zlib.inflateSync(raw); } catch { /* uncompressed */ }
    const s = decoded.toString("latin1");
    chunks.push(s);
    for (const hex of s.matchAll(/<([0-9A-Fa-f]+)>/g)) {
      chunks.push(Buffer.from(hex[1], "hex").toString("latin1"));
    }
  }
  return chunks.join("\n");
}

const samples = [
  "alvo HCO3 ≥ 22",
  "1,73 m² VANRAFIA® proteinúria",
  "μ g − → \u200b \u2011 \u2009 HCO₃ TFGe ≥ 60 ≤ 0,5",
  "“aspas” ‘simples’ … • — – ™",
];

async function assertHelvetica(label: string, text: string) {
  const safe = winAnsiSafe(text);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage();
  const line = safe.replace(/\n/g, " ").slice(0, 200) || " ";
  font.widthOfTextAtSize(line, 11);
  bold.widthOfTextAtSize(line, 11);
  page.drawText(line, { x: 40, y: 800, size: 11, font });
  const pdf = await doc.save();
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString("latin1"), "%PDF-", label);
}

async function main() {
  for (const s of samples) await assertHelvetica(s, s);
  for (const t of BUILTIN_TEMPLATES) {
    await assertHelvetica(t.id, `${t.title}\n${t.body}`);
  }

  const scientific = [
    "Os resultados finais de 2026 no ALIGNION, publicados no The Lancet, após 2,5 anos",
    "de acompanhamento, demonstraram manutenção do efeito antiproteinúrico e benefício",
    "na trajetória da função renal. A diferença na inclinação total da TFGe foi de",
    "1,4 mL/min/1,73 m² a favor da atrasentana (VANRAFIA®), 0,75 mg por via oral.",
    "Proteinúria de 4.637 mg/24 h — mais de quatro vezes o limiar de 1 g/dia.",
    "Símbolos: ≥ ≤ ≠ ≈ → ← − – — µ μg ¹ ² ³ ™ • … “aspas” ‘simples’ ‑ e zero\u200bwidth.",
  ].join("\n");
  assert.match(winAnsiSafe("≥ ≤"), />=/);
  assert.match(winAnsiSafe("≥ ≤"), /<=/);
  assert.doesNotMatch(winAnsiSafe(scientific), /[≥≤μ−→\u200b]/);

  const shim = path.join(path.dirname(fileURLToPath(import.meta.url)), "shims", "server-only.js");
  const builtin = Module as unknown as {
    _resolveFilename: (request: string, parent: unknown, isMain: boolean, options: unknown) => string;
  };
  const orig = builtin._resolveFilename;
  builtin._resolveFilename = function (request, parent, isMain, options) {
    if (request === "server-only") return shim;
    return orig.call(this, request, parent, isMain, options);
  };

  const { buildDocumentPdf, buildDocumentPdfDetailed, LETTERHEAD_EMBED_MAX_BYTES } = await import("../src/lib/document-engine");
  const { receitaFromLme, relatorioFromLme } = await import("../src/lib/complementary-docs");

  const area = { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all" as const, showPatientHeader: true, showSignature: true };
  const doctor = { name: "Dr. Carlos", crm: "12345", crmState: "BA", specialty: "Nefrologia" };

  const pdf = await buildDocumentPdf({
    title: "Relatório médico",
    content: scientific + "\n\n" + BUILTIN_TEMPLATES.find((t) => t.id === "rx_acidose")!.body,
    patient: { name: "Maria da Prestação", cpf: "000.000.000-00", idade: 54 },
    doctor,
    area,
  });
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString("latin1"), "%PDF-");
  assert.ok(pdf.byteLength > 800, `PDF pequeno demais: ${pdf.byteLength}`);

  const rx = receitaFromLme({
    cid10: "N04.0",
    medications: [{ name: "Ciclosporina 100 mg", presentation: "cápsula" }],
  });
  const rel = relatorioFromLme({
    cid10: "N18.0",
    diagnosis: "Anemia na DRC",
    medications: [{ name: "Alfaepoetina 4.000 UI", presentation: "injetável" }],
  });
  const rxPdf = await buildDocumentPdf({ title: rx.title, content: rx.body, patient: { name: "Maria da Prestação" }, doctor, area });
  const relPdf = await buildDocumentPdf({ title: rel.title, content: rel.body, patient: { name: "Maria da Prestação" }, doctor, area });
  assert.ok(rxPdf.byteLength > 800);
  assert.ok(relPdf.byteLength > 800);
  const rxText = extractPdfLatin1(rxPdf);
  const relText = extractPdfLatin1(relPdf);
  assert.match(rxText, /N04\.0/);
  assert.doesNotMatch(rxText, /N04\.0\?\?/);
  assert.match(rxText, /Ciclosporina/);
  assert.match(relText, /continuidade/);
  assert.match(relText, /manuten/);

  const lhDoc = await PDFDocument.create();
  const lhPage = lhDoc.addPage([595.28, 841.89]);
  lhPage.drawRectangle({ x: 20, y: 780, width: 555, height: 40, color: rgb(0.7, 0.05, 0.05) });
  const lhPdfBytes = await lhDoc.save();
  const withPdfLh = await buildDocumentPdfDetailed({
    title: rx.title,
    content: rx.body,
    patient: { name: "Maria da Prestação" },
    doctor,
    area: { ...area, marginTop: 0.22 },
    background: { kind: "pdf", bytes: lhPdfBytes },
  });
  assert.equal(withPdfLh.letterheadSkipped, false, "timbrado PDF válido tem que entrar no documento");
  assert.ok(withPdfLh.bytes.byteLength > rxPdf.byteLength);

  const sharp = (await import("sharp")).default;
  const w = 1800;
  const h = 2400;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 13 + (i % 97)) & 255;
  const bigJpg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
  assert.ok(bigJpg.length > 800 * 1024, `JPEG de teste pequeno demais: ${bigJpg.length}`);
  const withJpgLh = await buildDocumentPdfDetailed({
    title: rel.title,
    content: rel.body,
    patient: { name: "Maria da Prestação" },
    doctor,
    area: { ...area, marginTop: 0.22 },
    background: { kind: "image", bytes: bigJpg, mime: "image/jpeg" },
  });
  assert.equal(withJpgLh.letterheadSkipped, false, "timbrado JPG grande tem que entrar (reduzido), não ser pulado");
  assert.match(Buffer.from(withJpgLh.bytes).toString("latin1"), /DCTDecode|Image/);

  const tinyPng = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 90, b: 90 } },
  }).png().toBuffer();
  const withPngLh = await buildDocumentPdfDetailed({
    title: "Receita",
    content: "Losartana 50 mg",
    doctor,
    area,
    background: { kind: "image", bytes: tinyPng, mime: "image/png" },
  });
  assert.equal(withPngLh.letterheadSkipped, false);

  const garbage = await buildDocumentPdfDetailed({
    title: "Receita",
    content: "Losartana 50 mg",
    doctor,
    area,
    background: { kind: "pdf", bytes: Buffer.from("not-a-pdf") },
  });
  assert.equal(Buffer.from(garbage.bytes.slice(0, 5)).toString("latin1"), "%PDF-");
  assert.equal(garbage.letterheadSkipped, true);

  const huge = Buffer.alloc(LETTERHEAD_EMBED_MAX_BYTES + 10, 0xff);
  huge[0] = 0xff;
  huge[1] = 0xd8;
  const skipped = await buildDocumentPdfDetailed({
    title: "Receita",
    content: "1. Ciclosporina 100 mg cápsula",
    doctor,
    area,
    background: { kind: "image", bytes: huge, mime: "image/jpeg" },
  });
  assert.equal(skipped.letterheadSkipped, true);
  assert.ok(skipped.bytes.byteLength > 800);

  console.log("document-pdf ok", {
    templates: BUILTIN_TEMPLATES.length,
    bytes: pdf.byteLength,
    rx: rxPdf.byteLength,
    rel: relPdf.byteLength,
    jpgLh: withJpgLh.bytes.byteLength,
    pdfLh: withPdfLh.bytes.byteLength,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
