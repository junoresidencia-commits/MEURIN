import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { getLme } from "@/lib/lme-store";
import { getDocuments } from "@/lib/patient-store";
import { readFile, DOCPDF_BUCKET } from "@/lib/doc-storage";
import { buildOfficialCeafPdf } from "@/lib/ceaf-official-pdf";
import { inferProtocolId, officialTerSlot } from "@/lib/complementary-docs";
import { jsonUtf8 } from "@/lib/json-utf8";
import { todayBr } from "@/lib/pdf-winansi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pacote da LME: LME oficial + Receita + Relatório + TER oficial, nesta ordem.
 * Cada bloco começa com uma página de identificação. Não altera a LME oficial.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lme = await getLme(id);
  if (!lme) return jsonUtf8({ error: "LME não encontrada." }, 404);
  const doctorId = await getDoctorSessionId();
  if (!doctorId || doctorId !== lme.doctorId) {
    return jsonUtf8({ error: "Sem acesso." }, 403);
  }

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const docs = await getDocuments(lme.patientEmail);
  const linked = docs.filter((d) => d.sourceLmeId === id);
  const pick = (type: string) => {
    const pool = linked.filter((d) => d.type === type && d.pdfPath);
    const any = docs.filter((d) => d.type === type && d.pdfPath);
    const list = (pool.length ? pool : any).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return list[list.length - 1] || null;
  };

  const receita = pick("receita");
  const relatorio = pick("relatorio");
  const terSaved = pick("ter");
  const protocolId = inferProtocolId(lme);
  const terSlot = officialTerSlot(protocolId);

  const missing: string[] = [];
  if (!receita) missing.push("Receita");
  if (!relatorio) missing.push("Relatório médico");
  if (!terSaved && terSlot.status !== "available") missing.push("TER oficial (não disponível neste protocolo)");
  else if (!terSaved) missing.push("TER oficial");

  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const fontBold = await merged.embedFont(StandardFonts.HelveticaBold);

  const addLabel = async (n: number, title: string) => {
    const page = merged.addPage([595.28, 841.89]);
    page.drawText(`${n}. ${title}`, { x: 48, y: 780, size: 16, font: fontBold, color: rgb(0.05, 0.35, 0.32) });
    page.drawText(`Paciente: ${lme.patientName || "—"}`, { x: 48, y: 752, size: 11, font, color: rgb(0.15, 0.2, 0.25) });
    page.drawText(`LME ${id.slice(0, 8)} · ${todayBr()}`, { x: 48, y: 734, size: 10, font, color: rgb(0.4, 0.45, 0.5) });
    page.drawText("Meu Rim — ordem do pacote. O documento oficial começa na página seguinte.", { x: 48, y: 710, size: 9, font, color: rgb(0.4, 0.45, 0.5) });
  };

  const addPdf = async (bytes: ArrayBuffer | Uint8Array | Buffer) => {
    try {
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
      return true;
    } catch {
      return false;
    }
  };

  const officialUrl = new URL(`/api/lme/${id}/oficial?flatten=1`, req.url);
  const cookie = req.headers.get("cookie") || "";
  const ores = await fetch(officialUrl, { headers: { cookie } }).catch(() => null);
  if (ores && ores.ok) {
    await addLabel(1, "LME oficial");
    await addPdf(await ores.arrayBuffer());
  }

  if (receita?.pdfPath) {
    const file = await readFile(DOCPDF_BUCKET, receita.pdfStorage || "local", receita.pdfPath);
    if (file) {
      await addLabel(2, "Receita");
      await addPdf(file.buffer);
    }
  }
  if (relatorio?.pdfPath) {
    const file = await readFile(DOCPDF_BUCKET, relatorio.pdfStorage || "local", relatorio.pdfPath);
    if (file) {
      await addLabel(3, "Relatório médico");
      await addPdf(file.buffer);
    }
  }

  let terBytes: Uint8Array | null = null;
  if (terSaved?.pdfPath) {
    const file = await readFile(DOCPDF_BUCKET, terSaved.pdfStorage || "local", terSaved.pdfPath);
    if (file) terBytes = new Uint8Array(file.buffer);
  } else if (protocolId && terSlot.status === "available") {
    try {
      const built = await buildOfficialCeafPdf(protocolId, "ter", {
        name: lme.patientName || "",
        doctor: lme.doctorName || "",
        crm: lme.doctorCrm || "",
        date: todayBr(),
        cpf: lme.patientCpf || "",
      });
      terBytes = built.bytes;
    } catch {
      terBytes = null;
    }
  }
  if (terBytes) {
    await addLabel(4, "TER oficial — Termo de esclarecimento e responsabilidade");
    await addPdf(terBytes);
  }

  if (merged.getPageCount() === 0) {
    return jsonUtf8({ error: "Nada para montar (gere a Receita/Relatório em PDF primeiro)." }, 404);
  }

  const out = await merged.save();
  return new NextResponse(Buffer.from(out), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="pacote-lme.pdf"`,
      "X-MeuRim-Package-Missing": encodeURIComponent(missing.join(", ")),
    },
  });
}
