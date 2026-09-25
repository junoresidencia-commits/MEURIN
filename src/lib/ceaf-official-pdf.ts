import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  CEAF_PACOTE,
  officialDocSlot,
  terOverlay,
  type OfficialDocKind,
  type TerOverlayField,
} from "@/lib/ceaf-documents";
import { readCeafOfficialFile } from "@/lib/ceaf-official-pack";

function pdfSafe(text: string) {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFC")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export type OfficialOverlay = Partial<Record<TerOverlayField, string>>;

/** Extrai as páginas oficiais do pacote SESAB. Não redesenha o formulário. */
export async function buildOfficialCeafPdf(
  protocol: string,
  doc: OfficialDocKind,
  overlayValues?: OfficialOverlay,
): Promise<{ bytes: Uint8Array; label: string; pages: number[] }> {
  const slot = officialDocSlot(protocol, doc);
  if (slot.status !== "available") {
    throw Object.assign(new Error(slot.reason), { code: "OFFICIAL_UNAVAILABLE" });
  }
  const { bytes } = await readCeafOfficialFile(CEAF_PACOTE.file);
  const src = await PDFDocument.load(bytes);
  const valid = slot.pages.filter((i) => i >= 0 && i < src.getPageCount());
  if (valid.length === 0) throw new Error("Páginas oficiais fora do pacote SESAB.");

  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, valid);
  copied.forEach((p) => out.addPage(p));

  if (doc === "ter") {
    const overlay = slot.overlay ?? terOverlay(protocol);
    if (overlay.length && overlayValues) {
      const font = await out.embedFont(StandardFonts.Helvetica);
      const pages = out.getPages();
      for (const field of overlay) {
        const val = pdfSafe(overlayValues[field.field] || "");
        if (!val) continue;
        const pg = pages[field.page];
        if (!pg) continue;
        pg.drawText(val, { x: field.x, y: field.y, size: field.size ?? 10, font, color: rgb(0, 0, 0.55) });
      }
    }
  }

  return { bytes: await out.save(), label: slot.label, pages: valid };
}
