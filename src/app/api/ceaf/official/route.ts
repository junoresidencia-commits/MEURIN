import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import {
  CEAF_PACOTE,
  officialDocSlot,
  terOverlay,
  type OfficialDocKind,
  type TerOverlayField,
} from "@/lib/ceaf-documents";
import { readCeafOfficialFile } from "@/lib/ceaf-official-pack";
import { jsonUtf8 } from "@/lib/json-utf8";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DOCS: OfficialDocKind[] = ["ter", "form", "residencia"];

function pdfSafe(text: string) {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFC")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function asciiName(protocol: string, doc: string) {
  const slug = protocol.replace(/[^a-zA-Z0-9_-]+/g, "-") || "ceaf";
  return `${doc}-${slug}-oficial.pdf`;
}

/** Extrai as páginas oficiais exatas do pacote SESAB. Só médico logado. */
export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  const { searchParams } = new URL(req.url);
  const protocol = (searchParams.get("protocol") || "").trim();
  const doc = (searchParams.get("doc") || "") as OfficialDocKind;
  if (!DOCS.includes(doc)) return jsonUtf8({ error: "Informe o documento: ter, form ou residencia." }, 400);

  const slot = officialDocSlot(protocol, doc);
  if (slot.status !== "available") {
    console.info("[ceaf/official]", { protocolId: protocol, doc, status: 404, reason: slot.reason });
    return jsonUtf8(
      { error: "Não foi possível localizar o documento oficial deste protocolo. Tente novamente ou informe o suporte." },
      404,
    );
  }

  try {
    const { bytes, path: filePath } = await readCeafOfficialFile(CEAF_PACOTE.file);
    const src = await PDFDocument.load(bytes);
    const valid = slot.pages.filter((i) => i >= 0 && i < src.getPageCount());
    if (valid.length === 0) {
      console.error("[ceaf/official]", {
        protocolId: protocol,
        doc,
        status: 500,
        path: filePath,
        pages: slot.pages,
        pageCount: src.getPageCount(),
        error: "páginas fora do pacote",
      });
      return jsonUtf8({ error: "Não foi possível localizar o documento oficial deste protocolo. Tente novamente ou informe o suporte." }, 500);
    }

    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, valid);
    copied.forEach((p) => out.addPage(p));

    if (doc === "ter") {
      const overlay = slot.overlay ?? terOverlay(protocol);
      if (overlay.length) {
        const values: Record<TerOverlayField, string> = {
          name: searchParams.get("name") || "",
          doctor: searchParams.get("doctor") || "",
          crm: searchParams.get("crm") || "",
          date: searchParams.get("date") || "",
          cpf: searchParams.get("cpf") || "",
          birth: searchParams.get("birth") || "",
        };
        const font = await out.embedFont(StandardFonts.Helvetica);
        const pages = out.getPages();
        for (const field of overlay) {
          const val = pdfSafe(values[field.field] || "");
          if (!val) continue;
          const pg = pages[field.page];
          if (!pg) continue;
          pg.drawText(val, { x: field.x, y: field.y, size: field.size ?? 10, font, color: rgb(0, 0, 0.55) });
        }
      }
    }

    const pdf = await out.save();
    const fname = asciiName(protocol || "ceaf", doc);
    console.info("[ceaf/official]", { protocolId: protocol, doc, status: 200, path: filePath, pages: valid });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fname}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const tried = err && typeof err === "object" && "tried" in err ? (err as { tried?: string[] }).tried : undefined;
    console.error("[ceaf/official]", { protocolId: protocol, doc, status: 500, path: tried, error: "falha ao ler/gerar" });
    return jsonUtf8({ error: "Não foi possível gerar o documento oficial." }, 500);
  }
}
