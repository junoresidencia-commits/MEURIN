import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { getLetterhead, getDefaultLetterhead, type LetterheadArea } from "@/lib/letterheads-store";
import { LETTERHEADS_BUCKET, readFile } from "@/lib/doc-storage";
import { buildDocumentPdfDetailed, fillFields, LETTERHEAD_EMBED_MAX_BYTES, type DocBackground } from "@/lib/document-engine";
import { jsonUtf8 } from "@/lib/json-utf8";
import { todayBr } from "@/lib/pdf-winansi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sem papel timbrado: margens confortáveis e cabeçalho/assinatura próprios.
function defaultAreaNoLetterhead(): LetterheadArea {
  return { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all", showPatientHeader: true, showSignature: true };
}

/**
 * Documento avulso (sem paciente) gerado sobre o PAPEL TIMBRADO salvo do médico.
 * Não é vinculado a prontuário — devolve o PDF pronto para baixar/imprimir.
 */
export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "livre");
    const title = String(body.title || "").trim() || tituloPadrao(type);
    const content = String(body.content || "");
    const patientName = String(body.patientName || "").trim();
    // letterheadId: id específico; ""/null = papel branco (retry); ausente = padrão do médico.
    const letterheadRaw = body.letterheadId;

    const doctor = await getDoctorById(doctorId);
    if (!doctor) return jsonUtf8({ error: "Médico não encontrado." }, 404);

    // Papel timbrado: o escolhido, senão o padrão. Qualquer falha → papel branco (não 500).
    let background: DocBackground | null = null;
    let area: LetterheadArea = defaultAreaNoLetterhead();
    try {
      const wantId = letterheadRaw ? String(letterheadRaw) : "";
      const lh = wantId
        ? await getLetterhead(wantId)
        : letterheadRaw === undefined
          ? await getDefaultLetterhead(doctorId)
          : null;
      if (lh && lh.doctorId === doctorId) {
        const file = await readFile(LETTERHEADS_BUCKET, lh.storage, lh.filePath);
        if (file && file.buffer.length <= LETTERHEAD_EMBED_MAX_BYTES) {
          background = { kind: lh.kind, bytes: file.buffer, mime: lh.mime || file.mime };
          area = lh.area;
        }
      }
    } catch (err) {
      console.warn("[documents/avulso] letterhead_load_fallback", err instanceof Error ? err.message : err);
    }
    // Sem nome de paciente => não mostra o cabeçalho "Paciente:".
    if (!patientName) area = { ...area, showPatientHeader: false };

    const vars: Record<string, string> = {
      paciente_nome: patientName,
      data_atual: todayBr(),
      medico_nome: doctor.name,
      medico_crm: [doctor.crm, doctor.crmState].filter(Boolean).join("-"),
      medico_rqe: doctor.rqe || "",
      medico_especialidade: doctor.specialty || "",
    };

    const built = await buildDocumentPdfDetailed({
      title: fillFields(title, vars),
      content: fillFields(content, vars),
      patient: patientName ? { name: patientName } : undefined,
      doctor: { name: doctor.name, crm: doctor.crm, crmState: doctor.crmState, rqe: doctor.rqe, specialty: doctor.specialty },
      area,
      background,
    });
    const pdfBytes = built.bytes;

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${type}-meu-rim.pdf"`,
      },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    console.error("[documents/avulso]", { status: 500, error: name });
    return jsonUtf8({
      error: "Não foi possível gerar o documento. Tente de novo ou escolha “Sem papel timbrado”.",
    }, 500);
  }
}

function tituloPadrao(type: string): string {
  const map: Record<string, string> = {
    receita: "Receita", exame: "Pedido de exames", relatorio: "Relatório médico",
    atestado: "Atestado", declaracao: "Declaração", encaminhamento: "Encaminhamento",
    parecer: "Parecer", orientacao: "Orientações", laudo: "Laudo", livre: "Documento",
  };
  return map[type] || "Documento";
}
