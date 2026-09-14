import assert from "node:assert/strict";
import { accessSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { CEAF_PROTOCOLS } from "../src/lib/ceaf-catalog";
import {
  CEAF_LME_FILE,
  CEAF_PACOTE,
  PROTOCOL_OFFICIAL_DOCS,
  getProtocolOfficialDocs,
  officialDocPages,
  officialDocSlot,
  type OfficialDocKind,
} from "../src/lib/ceaf-documents";

function mustExist(rel: string) {
  const full = path.join(process.cwd(), "public", "forms", rel);
  accessSync(full);
  return full;
}

async function extractPages(packBytes: Buffer, pages: number[]) {
  const src = await PDFDocument.load(packBytes);
  assert.equal(src.getPageCount(), CEAF_PACOTE.pageCount, "contagem do pacote SESAB");
  const valid = pages.filter((i) => i >= 0 && i < src.getPageCount());
  assert.equal(valid.length, pages.length, `páginas inválidas: ${pages.join(",")}`);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, valid);
  copied.forEach((p) => out.addPage(p));
  const pdf = await out.save();
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString("latin1"), "%PDF-");
  assert.ok(pdf.byteLength > 400, `PDF extraído pequeno demais (${pdf.byteLength})`);
  return pdf.byteLength;
}

async function main() {
  const catalogIds = CEAF_PROTOCOLS.map((p) => p.id).sort();
  const mapIds = Object.keys(PROTOCOL_OFFICIAL_DOCS).sort();
  assert.deepEqual(mapIds, catalogIds, "todo protocolo do catálogo precisa de entrada explícita no mapa oficial");

  const packPath = mustExist(CEAF_PACOTE.file);
  mustExist(CEAF_LME_FILE);
  const packBytes = readFileSync(packPath);

  const kinds: OfficialDocKind[] = ["ter", "form", "residencia"];
  const report: Array<{ protocolId: string; doc: string; status: string; pages?: number[]; bytes?: number }> = [];

  for (const protocol of CEAF_PROTOCOLS) {
    const pack = getProtocolOfficialDocs(protocol.id);
    assert.equal(pack.lme.status, "available");
    assert.equal(pack.residence.status, "available");
    assert.deepEqual(pack.residence.pages, [16]);

    for (const kind of kinds) {
      const slot = officialDocSlot(protocol.id, kind);
      if (slot.status === "unavailable") {
        assert.equal(officialDocPages(protocol.id, kind), undefined);
        assert.ok(slot.reason.length > 10, `${protocol.id}/${kind} precisa de motivo explícito`);
        report.push({ protocolId: protocol.id, doc: kind, status: "unavailable" });
        continue;
      }
      const bytes = await extractPages(packBytes, slot.pages);
      report.push({ protocolId: protocol.id, doc: kind, status: "available", pages: slot.pages, bytes });
    }
  }

  const adult = getProtocolOfficialDocs("sindrome_nefrotica_adultos");
  assert.equal(adult.ter.status, "unavailable");
  assert.equal(adult.form.status, "unavailable");
  assert.equal(adult.residence.status, "available");
  assert.equal(officialDocPages("sindrome_nefrotica_adultos", "ter"), undefined);
  assert.ok(officialDocPages("sindrome_nefrotica_adultos", "residencia"));

  const unknown = getProtocolOfficialDocs("protocolo_inventado");
  assert.equal(unknown.ter.status, "unavailable");
  assert.equal(officialDocPages("protocolo_inventado", "form"), undefined);

  const broken = report.filter((row) => row.status === "available" && !row.bytes);
  assert.equal(broken.length, 0, "documento available sem PDF extraído");

  console.log("ceaf-official-docs ok", {
    protocols: catalogIds.length,
    pack: CEAF_PACOTE.file,
    pages: CEAF_PACOTE.pageCount,
    docs: report,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
