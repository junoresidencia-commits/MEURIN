import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { getLme } from "@/lib/lme-store";
import { getDocuments } from "@/lib/patient-store";
import { readFile, DOCPDF_BUCKET } from "@/lib/doc-storage";

/**
 * Pacote da LME: junta, num ÚNICO PDF, a LME oficial preenchida + os documentos
 * complementares (Receita/Relatório) já gerados com PDF para o paciente.
 * NÃO altera a LME nem os documentos — só copia as páginas para um novo PDF.
 * ?docs=id1,id2 escolhe documentos específicos; sem isso, usa o mais recente de
 * cada tipo. ?download=1 baixa como anexo (senão abre inline, para imprimir).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lme = await getLme(id);
  if (!lme) return NextResponse.json({ error: "LME não encontrada." }, { status: 404 });
  const doctorId = await getDoctorSessionId();
  if (!doctorId || doctorId !== lme.doctorId) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  const merged = await PDFDocument.create();
  const addPdf = async (bytes: ArrayBuffer | Uint8Array | Buffer) => {
    try {
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch { /* ignora PDF ilegível */ }
  };

  // 1) LME oficial preenchida (reusa a rota oficial, achatada, com o cookie da requisição).
  const officialUrl = new URL(`/api/lme/${id}/oficial?flatten=1`, req.url);
  const cookie = req.headers.get("cookie") || "";
  const ores = await fetch(officialUrl, { headers: { cookie } }).catch(() => null);
  if (ores && ores.ok) await addPdf(await ores.arrayBuffer());

  // 2) Documentos complementares (Receita/Relatório) com PDF salvo.
  const docs = await getDocuments(lme.patientEmail);
  const wanted = new URL(req.url).searchParams.get("docs");
  const ids = wanted ? new Set(wanted.split(",").filter(Boolean)) : null;
  const complementary = docs
    .filter((d) => d.pdfPath && (d.type === "receita" || d.type === "relatorio"))
    .filter((d) => (ids ? ids.has(d.id) : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let selected = complementary;
  if (!ids) {
    const byType = new Map<string, (typeof complementary)[number]>();
    for (const d of complementary) byType.set(d.type, d); // fica o mais recente de cada tipo
    selected = [...byType.values()];
  }
  for (const doc of selected) {
    const file = await readFile(DOCPDF_BUCKET, doc.pdfStorage || "local", doc.pdfPath!);
    if (file && file.mime === "application/pdf") await addPdf(file.buffer);
  }

  if (merged.getPageCount() === 0) {
    return NextResponse.json({ error: "Nada para montar (gere a Receita/Relatório em PDF primeiro)." }, { status: 404 });
  }
  const out = await merged.save();
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(Buffer.from(out), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="pacote-lme.pdf"`,
    },
  });
}
