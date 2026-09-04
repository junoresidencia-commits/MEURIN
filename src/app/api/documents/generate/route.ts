import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getPatient } from "@/lib/patients-store";
import { addDocument } from "@/lib/patient-store";
import { getLetterhead, type LetterheadArea } from "@/lib/letterheads-store";
import { LETTERHEADS_BUCKET, DOCPDF_BUCKET, readFile, saveFile } from "@/lib/doc-storage";
import { buildDocumentPdf, fillFields, type DocBackground } from "@/lib/document-engine";
import { writeAudit } from "@/lib/patient-shares-store";

export const maxDuration = 60;

function idadeFrom(birthdate?: string | null): string | null {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? String(a) : null;
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const patientParam = String(body.patientKey || body.patient || "").trim();
    const preview = body.preview === true;
    const type = String(body.type || "livre");
    const title = String(body.title || "").trim() || tituloPadrao(type);
    const content = String(body.content || "");
    const letterheadId = body.letterheadId ? String(body.letterheadId) : null;

    if (!patientParam) return NextResponse.json({ error: "Selecione o paciente." }, { status: 400 });

    const access = await resolvePatientAccess(patientParam);
    if (!access || !access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

    const doctor = await getDoctorById(doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

    // Dados do paciente para o cabeçalho (CPF só quando é paciente cadastrado).
    let cpf: string | undefined;
    let birthdate: string | null = access.birthdate;
    if (!patientParam.includes("@")) {
      const p = await getPatient(patientParam);
      if (p) { cpf = p.cpf || undefined; birthdate = p.birthdate || birthdate; }
    }

    // Papel timbrado (opcional). "Sem timbrado" => fundo branco.
    let background: DocBackground | null = null;
    let area: LetterheadArea = defaultAreaNoLetterhead();
    let usedLetterheadId: string | null = null;
    if (letterheadId) {
      const lh = await getLetterhead(letterheadId);
      if (!lh || lh.doctorId !== doctorId) return NextResponse.json({ error: "Papel timbrado inválido." }, { status: 400 });
      const file = await readFile(LETTERHEADS_BUCKET, lh.storage, lh.filePath);
      if (!file) return NextResponse.json({ error: "Arquivo do papel timbrado indisponível." }, { status: 400 });
      background = { kind: lh.kind, bytes: file.buffer, mime: lh.mime || file.mime };
      area = lh.area;
      usedLetterheadId = lh.id;
    }

    const vars: Record<string, string> = {
      paciente_nome: access.name || "",
      paciente_cpf: cpf || "",
      paciente_data_nascimento: birthdate ? new Date(birthdate).toLocaleDateString("pt-BR") : "",
      paciente_idade: idadeFrom(birthdate) || "",
      data_atual: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Bahia" }),
      medico_nome: doctor.name,
      medico_crm: [doctor.crm, doctor.crmState].filter(Boolean).join("-"),
      medico_rqe: doctor.rqe || "",
      medico_especialidade: doctor.specialty || "",
    };
    const filledContent = fillFields(content, vars);
    const filledTitle = fillFields(title, vars);

    const pdfBytes = await buildDocumentPdf({
      title: filledTitle,
      content: filledContent,
      patient: { name: access.name, cpf, birthdate, idade: idadeFrom(birthdate) },
      doctor: { name: doctor.name, crm: doctor.crm, crmState: doctor.crmState, rqe: doctor.rqe, specialty: doctor.specialty },
      area,
      background,
    });

    if (preview) {
      return new NextResponse(new Uint8Array(pdfBytes), {
        headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": "inline; filename=preview.pdf" },
      });
    }

    // Salva o PDF final no storage e cria o registro no prontuário (não disponível ao paciente ainda).
    const saved = await saveFile(DOCPDF_BUCKET, doctorId, { name: `${type}.pdf`, type: "application/pdf", buffer: Buffer.from(pdfBytes) });
    const now = new Date().toISOString();
    const doc = await addDocument({
      patientEmail: access.key,
      doctorId,
      doctorName: doctor.name,
      doctorCrm: doctor.crm,
      type,
      title: filledTitle,
      body: content, // guarda o conteúdo original (com {{campos}}) para reedição
      sharedWithPatient: false, // médico decide disponibilizar depois
      letterheadId: usedLetterheadId,
      pdfPath: saved.path,
      pdfStorage: saved.storage,
      status: "final",
      version: 1,
      groupId: uuid(),
      history: [{ at: now, by: doctor.name, action: "criado", detail: `Documento gerado (${type}).` }],
    });

    await writeAudit({
      doctorId,
      doctorName: doctor.name,
      patientKey: access.key,
      action: "documento_criado",
      detail: `${type}: ${filledTitle}`,
    });

    return NextResponse.json({ ok: true, id: doc.id, pdfUrl: `/api/documents/${doc.id}/pdf` }, { status: 201 });
  } catch (err) {
    console.error("documents/generate", err);
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

// Sem papel timbrado: margens confortáveis e cabeçalho/assinatura próprios.
function defaultAreaNoLetterhead(): LetterheadArea {
  return { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all", showPatientHeader: true, showSignature: true };
}
