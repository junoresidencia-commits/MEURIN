import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getPatient } from "@/lib/patients-store";
import { addDocument } from "@/lib/patient-store";
import { getLetterhead, type LetterheadArea } from "@/lib/letterheads-store";
import { LETTERHEADS_BUCKET, DOCPDF_BUCKET, readFile, saveFile } from "@/lib/doc-storage";
import { buildDocumentPdfDetailed, fillFields, LETTERHEAD_EMBED_MAX_BYTES, type DocBackground } from "@/lib/document-engine";
import { writeAudit } from "@/lib/patient-shares-store";
import { jsonUtf8 } from "@/lib/json-utf8";
import { todayBr } from "@/lib/pdf-winansi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const patientParam = String(body.patientKey || body.patient || "").trim();
    const preview = body.preview === true;
    const type = String(body.type || "livre");
    const title = String(body.title || "").trim() || tituloPadrao(type);
    const content = String(body.content || "");
    const letterheadId = body.letterheadId ? String(body.letterheadId) : null;

    if (!patientParam) return jsonUtf8({ error: "Selecione o paciente." }, 400);

    const access = await resolvePatientAccess(patientParam);
    if (!access || !access.allowed) return jsonUtf8({ error: "Sem acesso a este paciente." }, 403);

    const doctor = await getDoctorById(doctorId);
    if (!doctor) return jsonUtf8({ error: "Médico não encontrado." }, 404);

    // Dados do paciente para o cabeçalho (CPF só quando é paciente cadastrado).
    let cpf: string | undefined;
    let birthdate: string | null = access.birthdate;
    if (!patientParam.includes("@")) {
      const p = await getPatient(patientParam);
      if (p) { cpf = p.cpf || undefined; birthdate = p.birthdate || birthdate; }
    }

    // Papel timbrado (opcional). Qualquer falha (arquivo ausente, pesado, storage) sai em papel branco.
    let background: DocBackground | null = null;
    let area: LetterheadArea = defaultAreaNoLetterhead();
    let usedLetterheadId: string | null = null;
    let letterheadWarning = false;
    if (letterheadId) {
      try {
        const lh = await getLetterhead(letterheadId);
        if (!lh || lh.doctorId !== doctorId) {
          letterheadWarning = true;
          console.warn("[documents/generate]", { type, preview, letterheadId, status: 200, error: "letterhead_invalid_fallback" });
        } else {
          const file = await readFile(LETTERHEADS_BUCKET, lh.storage, lh.filePath);
          if (!file) {
            letterheadWarning = true;
            console.warn("[documents/generate]", { type, preview, letterheadId, status: 200, error: "letterhead_missing_fallback" });
          } else if (file.buffer.length > LETTERHEAD_EMBED_MAX_BYTES) {
            letterheadWarning = true;
            console.warn("[documents/generate]", { type, preview, letterheadId, status: 200, error: "letterhead_too_large_fallback", bytes: file.buffer.length });
          } else {
            background = { kind: lh.kind, bytes: file.buffer, mime: lh.mime || file.mime };
            area = lh.area;
            usedLetterheadId = lh.id;
          }
        }
      } catch (err) {
        letterheadWarning = true;
        console.warn("[documents/generate]", {
          type,
          preview,
          letterheadId,
          status: 200,
          error: "letterhead_load_fallback",
          detail: err instanceof Error ? err.message.slice(0, 180) : "unknown",
        });
      }
    }

    let nascimento = "";
    if (birthdate) {
      try {
        const d = new Date(birthdate);
        if (!Number.isNaN(d.getTime())) nascimento = d.toLocaleDateString("pt-BR");
      } catch {
        nascimento = "";
      }
    }
    const vars: Record<string, string> = {
      paciente_nome: access.name || "",
      paciente_cpf: cpf || "",
      paciente_data_nascimento: nascimento,
      paciente_idade: idadeFrom(birthdate) || "",
      data_atual: todayBr(),
      medico_nome: doctor.name,
      medico_crm: [doctor.crm, doctor.crmState].filter(Boolean).join("-"),
      medico_rqe: doctor.rqe || "",
      medico_especialidade: doctor.specialty || "",
    };
    const filledContent = fillFields(content, vars);
    const filledTitle = fillFields(title, vars);

    let pdfBytes: Uint8Array;
    try {
      const built = await buildDocumentPdfDetailed({
        title: filledTitle,
        content: filledContent,
        patient: { name: access.name, cpf, birthdate, idade: idadeFrom(birthdate) },
        doctor: { name: doctor.name, crm: doctor.crm, crmState: doctor.crmState, rqe: doctor.rqe, specialty: doctor.specialty },
        area,
        background,
      });
      pdfBytes = built.bytes;
      if (built.letterheadSkipped) {
        letterheadWarning = true;
        usedLetterheadId = null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      console.error("[documents/generate] pdf", { type, preview, detail: message.slice(0, 180) });
      return jsonUtf8({
        error: "Não foi possível montar o PDF. O texto da receita/relatório continua na tela — tente de novo ou gere sem papel timbrado.",
      }, 500);
    }

    if (preview) {
      console.info("[documents/generate]", { type, preview: true, status: 200, letterhead: usedLetterheadId ? "ok" : letterheadWarning ? "fallback" : "none" });
      return new NextResponse(new Uint8Array(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
          "Content-Disposition": "inline; filename=preview.pdf",
          ...(letterheadWarning ? { "X-MeuRim-Warning": "letterhead-unavailable" } : {}),
        },
      });
    }

    // Salva o PDF final no storage e cria o registro no prontuário (não disponível ao paciente ainda).
    let saved: { path: string; storage: "supabase" | "local" };
    try {
      saved = await saveFile(DOCPDF_BUCKET, doctorId, { name: `${type}.pdf`, type: "application/pdf", buffer: Buffer.from(pdfBytes) });
    } catch (err) {
      console.error("[documents/generate]", { type, preview: false, status: 500, error: "saveFile" });
      return jsonUtf8({ error: "Não foi possível guardar o PDF. Tente novamente." }, 500);
    }
    const now = new Date().toISOString();
    let doc;
    try {
      doc = await addDocument({
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
    } catch (err) {
      console.error("[documents/generate]", { type, preview: false, status: 500, error: "addDocument" });
      return jsonUtf8({ error: "Não foi possível registrar o documento no prontuário." }, 500);
    }

    try {
      await writeAudit({
        doctorId,
        doctorName: doctor.name,
        patientKey: access.key,
        action: "documento_criado",
        detail: `${type}: ${filledTitle}`,
      });
    } catch (err) {
      console.error("[documents/generate] audit", err);
    }

    return jsonUtf8({
      ok: true,
      id: doc.id,
      pdfUrl: `/api/documents/${doc.id}/pdf`,
      warning: letterheadWarning ? "Papel timbrado indisponível no momento. O documento foi gerado em papel branco." : undefined,
    }, 201);
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[documents/generate]", { status: 500, error: name, detail: message.slice(0, 180) });
    return jsonUtf8({
      error: "Não foi possível gerar o documento. O texto continua salvo na tela. Tente de novo ou escolha “Sem papel timbrado”.",
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

// Sem papel timbrado: margens confortáveis e cabeçalho/assinatura próprios.
function defaultAreaNoLetterhead(): LetterheadArea {
  return { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all", showPatientHeader: true, showSignature: true };
}
