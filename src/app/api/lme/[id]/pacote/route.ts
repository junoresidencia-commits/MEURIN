import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { getLme } from "@/lib/lme-store";
import { getDocuments } from "@/lib/patient-store";
import { readFile, DOCPDF_BUCKET } from "@/lib/doc-storage";
import { inferProtocolFromMedNames, officialDocPages } from "@/lib/ceaf-documents";
import { inferCeafProtocols } from "@/lib/ceaf-catalog";
import { buildOfficialCeafPdf, type FillValues } from "@/lib/ceaf-official-pdf";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { idadeFromBirthdate, todayBr } from "@/lib/pdf-winansi";

/**
 * Pacote da LME: junta, num ÚNICO PDF, a LME oficial preenchida + TER/formulário
 * oficiais (quando existirem no pacote SESAB) + Receita/Relatório já gerados.
 * NÃO altera a LME nem os documentos — só copia as páginas para um novo PDF.
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

  // 1b) TER + formulário oficiais do protocolo inferido (páginas exatas da SESAB).
  const medNames = (lme.medications || []).map((m) => m.name || "").filter(Boolean);
  const protocol =
    inferProtocolFromMedNames(medNames) ||
    inferCeafProtocols({ cid10: lme.cid10, medications: lme.medications })[0] ||
    "";
  if (protocol) {
    const doctor = await getDoctorById(doctorId);
    const values: FillValues = {
      introName: lme.patientName || "",
      name: lme.patientName || "",
      cpf: lme.patientCpf || "",
      cns: lme.patientCns || "",
      introDoctor: lme.doctorName || doctor?.name || "",
      doctor: lme.doctorName || doctor?.name || "",
      crm: (lme.doctorCrm || [doctor?.crm, doctor?.crmState].filter(Boolean).join("-") || "").replace(/^-+|-+$/g, ""),
      date: new Date(lme.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Bahia" }) || todayBr(),
      service: lme.establishmentName || "",
      uf: (doctor?.crmState || "BA").toUpperCase().slice(0, 2),
    };
    const crmNum = String(values.crm || "").match(/(\d{3,})/)?.[1] || String(values.crm || "").replace(/-.*$/, "").trim();
    if (crmNum) values.crm = crmNum;
    const access = await resolvePatientAccess(lme.patientEmail);
    if (access?.allowed) {
      values.age = idadeFromBirthdate(access.birthdate);
      if (!values.cpf) values.cpf = access.cpf || "";
      if (!values.cns) values.cns = access.cns || "";
      values.city = (access.city || "").split(/[,\-/]/).map((p) => p.trim()).filter(Boolean).pop() || "";
      values.local = values.city || values.service || "";
    }
    for (const doc of ["ter", "form"] as const) {
      if (!officialDocPages(protocol, doc)) continue;
      const built = await buildOfficialCeafPdf({ protocol, doc, values, medNames });
      if (built.ok) await addPdf(built.pdf);
    }
  }

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
