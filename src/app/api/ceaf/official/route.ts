import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { CEAF_PACOTE, officialDocPages, TER_OVERLAY } from "@/lib/ceaf-documents";

export const maxDuration = 30;

/** Extrai e serve as PÁGINAS OFICIAIS exatas (TER, formulário ou declaração) do pacote SESAB.
 *  Não redesenha nada — apenas recorta o documento oficial. Somente médico logado. */
export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const protocol = searchParams.get("protocol") || "";
  const doc = (searchParams.get("doc") || "") as "ter" | "form" | "residencia";
  const ref = officialDocPages(protocol, doc);
  if (!ref) return NextResponse.json({ error: "Documento oficial não encontrado para este protocolo." }, { status: 404 });

  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "forms", CEAF_PACOTE.file));
    const src = await PDFDocument.load(bytes);
    const out = await PDFDocument.create();
    const valid = ref.pages.filter((i) => i >= 0 && i < src.getPageCount());
    const copied = await out.copyPages(src, valid);
    copied.forEach((p) => out.addPage(p));

    // Sobreposição do nome do paciente / médico / data no TER oficial (achatado), quando informado.
    if (doc === "ter" && TER_OVERLAY[protocol]) {
      const name = searchParams.get("name") || "";
      const doctor = searchParams.get("doctor") || "";
      const crm = searchParams.get("crm") || "";
      const date = searchParams.get("date") || "";
      const values: Record<string, string> = { name, doctor, crm, date };
      const font = await out.embedFont(StandardFonts.Helvetica);
      const pages = out.getPages();
      for (const f of TER_OVERLAY[protocol]) {
        const val = values[f.field];
        if (!val) continue;
        const pg = pages[f.page];
        if (!pg) continue;
        pg.drawText(val, { x: f.x, y: f.y, size: f.size ?? 10, font, color: rgb(0, 0, 0.55) });
      }
    }

    const pdf = await out.save();
    const fname = `${doc}-${protocol || "ceaf"}-oficial.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fname}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("ceaf/official", err);
    return NextResponse.json({ error: "Não foi possível gerar o documento oficial." }, { status: 500 });
  }
}

/** POST: gera o documento oficial com CAIXAS DE TEXTO posicionadas pelo usuário (frações 0..1
 *  medidas do topo/esquerda). body: { protocol, doc, boxes: [{page,xFrac,yFrac,text,size?}] }.
 *  Não redesenha o oficial — apenas escreve o texto onde o médico posicionou. */
export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const protocol = String(body.protocol || "");
  const doc = (String(body.doc || "") as "ter" | "form" | "residencia");
  const ref = officialDocPages(protocol, doc);
  if (!ref) return NextResponse.json({ error: "Documento oficial não encontrado." }, { status: 404 });
  const boxes = Array.isArray(body.boxes) ? body.boxes : [];
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "forms", CEAF_PACOTE.file));
    const src = await PDFDocument.load(bytes);
    const out = await PDFDocument.create();
    const valid = ref.pages.filter((i) => i >= 0 && i < src.getPageCount());
    const copied = await out.copyPages(src, valid);
    copied.forEach((p) => out.addPage(p));
    const font = await out.embedFont(StandardFonts.Helvetica);
    const pages = out.getPages();
    for (const b of boxes) {
      const text = String(b?.text ?? "").trim();
      if (!text) continue;
      const pi = Math.max(0, Math.min(pages.length - 1, Number(b?.page) || 0));
      const pg = pages[pi];
      const { width, height } = pg.getSize();
      const size = Math.max(6, Math.min(24, Number(b?.size) || 10));
      const x = Math.max(0, Math.min(1, Number(b?.xFrac) || 0)) * width;
      const yTop = Math.max(0, Math.min(1, Number(b?.yFrac) || 0)) * height; // do topo (como na tela)
      const y = height - yTop - size;
      pg.drawText(text, { x, y, size, font, color: rgb(0, 0, 0.55) });
    }
    const pdf = await out.save();
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc}-${protocol}-preenchido.pdf"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("ceaf/official POST", err);
    return NextResponse.json({ error: "Não foi possível gerar o documento." }, { status: 500 });
  }
}
