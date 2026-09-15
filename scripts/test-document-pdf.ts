import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { BUILTIN_TEMPLATES } from "../src/lib/document-templates";
import { winAnsiSafe } from "../src/lib/pdf-winansi";

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

  const { buildDocumentPdf } = await import("../src/lib/document-engine");
  const pdf = await buildDocumentPdf({
    title: "Relatório médico",
    content: scientific + "\n\n" + BUILTIN_TEMPLATES.find((t) => t.id === "rx_acidose")!.body,
    patient: { name: "Maria da Prestação", cpf: "000.000.000-00", idade: 54 },
    doctor: { name: "Dr. Carlos", crm: "12345", crmState: "BA", specialty: "Nefrologia" },
    area: { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all", showPatientHeader: true, showSignature: true },
  });
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString("latin1"), "%PDF-");
  assert.ok(pdf.byteLength > 800, `PDF pequeno demais: ${pdf.byteLength}`);
  console.log("document-pdf ok", { templates: BUILTIN_TEMPLATES.length, bytes: pdf.byteLength });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
