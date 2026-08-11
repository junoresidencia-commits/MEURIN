import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { CEAF_PACOTE, officialDocPages } from "@/lib/ceaf-documents";

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
