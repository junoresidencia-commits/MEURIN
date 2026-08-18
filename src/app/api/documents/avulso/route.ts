import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { getLetterhead, getDefaultLetterhead, type LetterheadArea } from "@/lib/letterheads-store";
import { LETTERHEADS_BUCKET, readFile } from "@/lib/doc-storage";
import { buildDocumentPdf, fillFields, type DocBackground } from "@/lib/document-engine";

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
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "livre");
    const title = String(body.title || "").trim() || tituloPadrao(type);
    const content = String(body.content || "");
    const patientName = String(body.patientName || "").trim();
    // letterheadId: id específico, "" ou ausente => usa o timbrado padrão do médico.
    const wantId = body.letterheadId !== undefined ? String(body.letterheadId) : null;

    const doctor = await getDoctorById(doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

    // Papel timbrado: o escolhido, senão o padrão do médico. Se não houver, fundo branco.
    let background: DocBackground | null = null;
    let area: LetterheadArea = defaultAreaNoLetterhead();
    const lh = wantId ? await getLetterhead(wantId) : await getDefaultLetterhead(doctorId);
    if (lh) {
      if (lh.doctorId !== doctorId) return NextResponse.json({ error: "Papel timbrado inválido." }, { status: 400 });
      const file = await readFile(LETTERHEADS_BUCKET, lh.storage, lh.filePath);
      if (file) {
        background = { kind: lh.kind, bytes: file.buffer, mime: lh.mime || file.mime };
        area = lh.area;
      }
    }
    // Sem nome de paciente => não mostra o cabeçalho "Paciente:".
    if (!patientName) area = { ...area, showPatientHeader: false };

    const vars: Record<string, string> = {
      paciente_nome: patientName,
      data_atual: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Bahia" }),
      medico_nome: doctor.name,
      medico_crm: [doctor.crm, doctor.crmState].filter(Boolean).join("-"),
      medico_rqe: doctor.rqe || "",
      medico_especialidade: doctor.specialty || "",
    };

    const pdfBytes = await buildDocumentPdf({
      title: fillFields(title, vars),
      content: fillFields(content, vars),
      patient: patientName ? { name: patientName } : undefined,
      doctor: { name: doctor.name, crm: doctor.crm, crmState: doctor.crmState, rqe: doctor.rqe, specialty: doctor.specialty },
      area,
      background,
    });

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${type}-meu-rim.pdf"`,
      },
    });
  } catch (err) {
    console.error("documents/avulso", err);
    return NextResponse.json({ error: "Não foi possível gerar o documento." }, { status: 500 });
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
