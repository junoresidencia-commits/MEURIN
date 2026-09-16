import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  CEAF_PACOTE,
  officialDocSlot,
  officialOverlay,
  TER_MED_MARKS,
  TER_MED_SKIP_AUTO,
  terMedKeysFromNames,
  type OfficialDocKind,
  type OverlayField,
  type OverlayFieldName,
} from "@/lib/ceaf-documents";
import { readCeafOfficialFile } from "@/lib/ceaf-official-pack";
import { winAnsiSafe } from "@/lib/pdf-winansi";

export type FillValues = Partial<Record<OverlayFieldName, string>>;

function asciiName(protocol: string, doc: string) {
  const slug = protocol.replace(/[^a-zA-Z0-9_-]+/g, "-") || "ceaf";
  return `${doc}-${slug}-oficial.pdf`;
}

function fit(font: PDFFont, text: string, size: number, maxWidth?: number): string {
  let t = winAnsiSafe(text || "").trim();
  if (!t) return "";
  if (!maxWidth || maxWidth <= 0) return t;
  try {
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -1);
  } catch {
    t = t.slice(0, Math.max(1, Math.floor(maxWidth / (size * 0.5))));
  }
  return t;
}

function drawFields(pages: PDFPage[], font: PDFFont, fields: OverlayField[] | undefined, values: FillValues) {
  if (!fields?.length) return;
  for (const f of fields) {
    const val = values[f.field];
    if (!val) continue;
    const pg = pages[f.page];
    if (!pg) continue;
    const size = f.size ?? 10;
    const text = fit(font, val, size, f.maxWidth);
    if (!text) continue;
    try {
      pg.drawText(text, { x: f.x, y: f.y, size, font, color: rgb(0, 0, 0) });
    } catch {
      /* caractere residual — não bloqueia o PDF oficial */
    }
  }
}

export type OfficialPdfOk = { ok: true; pdf: Uint8Array; filename: string; pages: number[] };
export type OfficialPdfErr = { ok: false; error: string; status: number; reason?: string };

/** Extrai as páginas oficiais do pacote SESAB e preenche identificação. */
export async function buildOfficialCeafPdf(opts: {
  protocol: string;
  doc: OfficialDocKind;
  values?: FillValues;
  medNames?: string[];
}): Promise<OfficialPdfOk | OfficialPdfErr> {
  const protocol = (opts.protocol || "").trim();
  const slot = officialDocSlot(protocol, opts.doc);
  if (slot.status !== "available") {
    return { ok: false, error: "Não foi possível localizar o documento oficial deste protocolo. Tente novamente ou informe o suporte.", status: 404, reason: slot.reason };
  }

  try {
    const { bytes, path: filePath } = await readCeafOfficialFile(CEAF_PACOTE.file);
    const src = await PDFDocument.load(bytes);
    const valid = slot.pages.filter((i) => i >= 0 && i < src.getPageCount());
    if (valid.length === 0) {
      console.error("[ceaf/official]", {
        protocolId: protocol,
        doc: opts.doc,
        status: 500,
        path: filePath,
        pages: slot.pages,
        pageCount: src.getPageCount(),
        error: "páginas fora do pacote",
      });
      return { ok: false, error: "Não foi possível localizar o documento oficial deste protocolo. Tente novamente ou informe o suporte.", status: 500 };
    }

    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, valid);
    copied.forEach((p) => out.addPage(p));

    const font = await out.embedFont(StandardFonts.Helvetica);
    const pages = out.getPages();
    const overlay = slot.overlay ?? officialOverlay(protocol, opts.doc);
    drawFields(pages, font, overlay, opts.values || {});

    if (opts.doc === "ter") {
      const marks = TER_MED_MARKS[protocol] || {};
      const selected = terMedKeysFromNames(opts.medNames || []).filter((k) => !TER_MED_SKIP_AUTO.includes(k));
      for (const key of selected) {
        const m = marks[key];
        if (!m) continue;
        const pg = pages[m.page];
        if (!pg) continue;
        try {
          pg.drawText("X", { x: m.x, y: m.y, size: m.size ?? 10, font, color: rgb(0, 0, 0) });
        } catch {
          /* ok */
        }
      }
    }

    const pdf = await out.save();
    console.info("[ceaf/official]", { protocolId: protocol, doc: opts.doc, status: 200, path: filePath, pages: valid });
    return { ok: true, pdf, filename: asciiName(protocol || "ceaf", opts.doc), pages: valid };
  } catch (err) {
    const tried = err && typeof err === "object" && "tried" in err ? (err as { tried?: string[] }).tried : undefined;
    console.error("[ceaf/official]", { protocolId: protocol, doc: opts.doc, status: 500, path: tried, error: "falha ao ler/gerar" });
    return { ok: false, error: "Não foi possível gerar o documento oficial.", status: 500 };
  }
}
