import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getPatient } from "@/lib/patients-store";
import { addDocument, findLmeLinkedDocument, getDocumentById, updateDocument } from "@/lib/patient-store";
import { getLetterhead, type LetterheadArea } from "@/lib/letterheads-store";
import { LETTERHEADS_BUCKET, DOCPDF_BUCKET, readFile, saveFile } from "@/lib/doc-storage";
import { buildDocumentPdfDetailed, fillFields, LETTERHEAD_EMBED_MAX_BYTES, type DocBackground } from "@/lib/document-engine";
import { writeAudit } from "@/lib/patient-shares-store";
import { jsonUtf8 } from "@/lib/json-utf8";
import { todayBr } from "@/lib/pdf-winansi";
import { getLme } from "@/lib/lme-store";

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

function fail(status: number, error: string, detail?: string, extra?: Record<string, unknown>) {
  console.error("[documents/generate]", { status, error, detail: detail?.slice(0, 220), ...extra });
  return jsonUtf8({ error, detail: detail?.slice(0, 180) }, status);
}

export async function POST(req: Request) {
  let doctorId: string | null = null;
  try {
    doctorId = await getDoctorSessionId();
  } catch (err) {
    return fail(401, "Não autenticado.", err instanceof Error ? err.message : "auth");
  }
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const patientParam = String(body.patientKey || body.patient || "").trim();
    const preview = body.preview === true;
    const type = String(body.type || "livre");
    const title = String(body.title || "").trim() || tituloPadrao(type);
    const content = String(body.content || "");
    const letterheadId = body.letterheadId ? String(body.letterheadId) : null;
    const lmeId = body.lmeId ? String(body.lmeId).trim() : "";
    const replaceId = body.replaceId ? String(body.replaceId).trim() : "";

    if (!patientParam) return jsonUtf8({ error: "Selecione o paciente." }, 400);

    let access;
    try {
      access = await resolvePatientAccess(patientParam);
    } catch (err) {
      return fail(500, "Não foi possível confirmar o acesso a este paciente.", err instanceof Error ? err.message : "access");
    }
    if (!access || !access.allowed) return jsonUtf8({ error: "Sem acesso a este paciente." }, 403);

    let doctor;
    try {
      doctor = await getDoctorById(doctorId);
    } catch (err) {
      return fail(500, "Não foi possível carregar o médico.", err instanceof Error ? err.message : "doctor");
    }
    if (!doctor) return jsonUtf8({ error: "Médico não encontrado." }, 404);

    if (lmeId) {
      const lme = await getLme(lmeId).catch(() => null);
      if (!lme) return jsonUtf8({ error: "LME não encontrada." }, 404);
      if (lme.doctorId && lme.doctorId !== doctorId) return jsonUtf8({ error: "Sem acesso a esta LME." }, 403);
    }

    let cpf: string | undefined;
    let birthdate: string | null = access.birthdate;
    if (!patientParam.includes("@")) {
      try {
        const p = await getPatient(patientParam);
        if (p) { cpf = p.cpf || undefined; birthdate = p.birthdate || birthdate; }
      } catch (err) {
        console.warn("[documents/generate] getPatient", err instanceof Error ? err.message : "unknown");
      }
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
      return fail(
        500,
        "Não foi possível montar o PDF. O texto da receita/relatório continua na tela — tente de novo ou gere sem papel timbrado.",
        err instanceof Error ? err.message : "pdf",
      );
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

    let saved: { path: string; storage: "supabase" | "local" };
    try {
      saved = await saveFile(DOCPDF_BUCKET, doctorId, { name: `${type}.pdf`, type: "application/pdf", buffer: Buffer.from(pdfBytes) });
    } catch (err) {
      return fail(500, "Não foi possível guardar o PDF. Tente novamente.", err instanceof Error ? err.message : "saveFile");
    }

    const now = new Date().toISOString();
    let existing = replaceId ? await getDocumentById(replaceId).catch(() => null) : null;
    if (!existing && lmeId) {
      existing = await findLmeLinkedDocument(access.key, lmeId, type).catch(() => null);
    }
    if (existing && existing.doctorId !== doctorId) existing = null;
    if (existing && existing.status === "signed") existing = null;

    let doc;
    try {
      if (existing) {
        const updated = await updateDocument(existing.id, {
          title: filledTitle,
          body: content,
          type,
          letterheadId: usedLetterheadId,
          pdfPath: saved.path,
          pdfStorage: saved.storage,
          status: "final",
          sourceLmeId: lmeId || existing.sourceLmeId || null,
          history: [
            ...(existing.history || []),
            { at: now, by: doctor.name, action: "atualizado", detail: `PDF gerado novamente (${type}${lmeId ? `, LME ${lmeId}` : ""}).` },
          ],
        });
        doc = updated || existing;
      } else {
        doc = await addDocument({
          patientEmail: access.key,
          doctorId,
          doctorName: doctor.name,
          doctorCrm: doctor.crm,
          type,
          title: filledTitle,
          body: content,
          sharedWithPatient: false,
          letterheadId: usedLetterheadId,
          pdfPath: saved.path,
          pdfStorage: saved.storage,
          status: "final",
          version: 1,
          groupId: uuid(),
          sourceLmeId: lmeId || null,
          history: [{ at: now, by: doctor.name, action: "criado", detail: `Documento gerado (${type}${lmeId ? `, LME ${lmeId}` : ""}).` }],
        });
      }
    } catch (err) {
      return fail(500, "Não foi possível registrar o documento no prontuário. O texto continua na tela.", err instanceof Error ? err.message : "addDocument");
    }

    try {
      await writeAudit({
        doctorId,
        doctorName: doctor.name,
        patientKey: access.key,
        action: "documento_criado",
        detail: `${type}: ${filledTitle}${lmeId ? ` (LME ${lmeId})` : ""}`,
      });
    } catch (err) {
      console.error("[documents/generate] audit", err);
    }

    return jsonUtf8({
      ok: true,
      id: doc.id,
      pdfUrl: `/api/documents/${doc.id}/pdf`,
      reused: Boolean(existing),
      warning: letterheadWarning ? "Papel timbrado indisponível no momento. O documento foi gerado em papel branco." : undefined,
    }, existing ? 200 : 201);
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    const message = err instanceof Error ? err.message : "unknown";
    return fail(
      500,
      "Não foi possível gerar o documento. O texto continua salvo na tela. Tente de novo ou escolha “Sem papel timbrado”.",
      `${name}: ${message}`,
    );
  }
}

function tituloPadrao(type: string): string {
  const map: Record<string, string> = {
    receita: "Receita", exame: "Pedido de exames", relatorio: "Relatório médico",
    atestado: "Atestado", declaracao: "Declaração", encaminhamento: "Encaminhamento",
    parecer: "Parecer", orientacao: "Orientações", laudo: "Laudo", livre: "Documento",
    ter: "TER oficial", consentimento: "Termo de consentimento",
  };
  return map[type] || "Documento";
}

function defaultAreaNoLetterhead(): LetterheadArea {
  return { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all", showPatientHeader: true, showSignature: true };
}
