import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { getLetterhead } from "@/lib/letterheads-store";
import { fillPlaceholders, generateMedicalPdf, pdfToDataUrl } from "@/lib/document-motor";
import {
  addDocument,
  getDocumentById,
  updateDocument,
  type DocumentMedication,
  type DocumentType,
} from "@/lib/patient-store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { sendNotification, patientKey } from "@/lib/notify";

const TYPES: DocumentType[] = [
  "receita",
  "exame",
  "relatorio",
  "evolucao",
  "parecer",
  "atestado",
  "declaracao",
  "encaminhamento",
  "orientacao",
  "plano",
  "resumo",
  "alta",
  "carta",
  "termo",
  "lme",
  "laudo",
  "livre",
  "pronto",
];

const DEFAULT_TITLE: Partial<Record<DocumentType, string>> = {
  receita: "Receita médica",
  exame: "Solicitação de exames",
  relatorio: "Relatório médico",
  evolucao: "Evolução médica",
  parecer: "Parecer médico",
  atestado: "Atestado médico",
  declaracao: "Declaração",
  encaminhamento: "Encaminhamento",
  orientacao: "Orientações",
  plano: "Plano terapêutico",
  resumo: "Resumo clínico",
  alta: "Resumo de alta",
  carta: "Carta médica",
  termo: "Termo",
  lme: "LME",
  laudo: "Laudo",
  livre: "Documento",
  pronto: "Documento anexado",
};

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "preview");
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 403 });

  if (action === "share" || action === "unshare") {
    const id = String(body.documentId || "");
    const current = await getDocumentById(id);
    if (!current || current.doctorId !== doctorId) {
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    }
    const share = action === "share";
    const updated = await updateDocument(id, doctorId, {
      sharedWithPatient: share,
      history: [
        ...(current.history || []),
        {
          at: new Date().toISOString(),
          actor: doctor.name,
          action: share ? "disponibilizado" : "removido_paciente",
          detail: share
            ? "Documento disponibilizado na área do paciente"
            : "Removido da área do paciente (prontuário preservado)",
        },
      ],
    });
    if (share && updated) {
      await sendNotification({
        userId: patientKey(updated.patientEmail),
        role: "paciente",
        type: "documento_disponivel",
        title: "Novo documento disponível",
        body: `${doctor.name} disponibilizou um novo documento.`,
        targetUrl: `/paciente/documentos`,
        tag: `doc-${updated.id}`,
        relatedType: "document",
        relatedId: updated.id,
      }).catch(() => {});
    }
    return NextResponse.json({ document: sanitize(updated), shared: share });
  }

  if (action === "sign") {
    const id = String(body.documentId || "");
    const current = await getDocumentById(id);
    if (!current || current.doctorId !== doctorId) {
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    }
    if (current.status === "signed") {
      return NextResponse.json({ error: "Já assinado. Alterações exigem nova versão." }, { status: 409 });
    }
    const hash = createHash("sha256")
      .update(current.pdfData || current.body || current.id)
      .digest("hex")
      .slice(0, 32);
    const updated = await updateDocument(id, doctorId, {
      status: "signed",
      signatureMethod: "rubrica_texto",
      signedAt: new Date().toISOString(),
      signatureHash: hash,
      history: [
        ...(current.history || []),
        {
          at: new Date().toISOString(),
          actor: doctor.name,
          action: "assinado",
          detail: `Rubrica eletrônica registrada (hash ${hash}). Não é assinatura digital certificada.`,
        },
      ],
    });
    return NextResponse.json({ document: sanitize(updated) });
  }

  const patientParam = String(body.patientKey || body.email || "");
  const access = patientParam ? await resolvePatientAccess(patientParam) : null;
  if (action === "save") {
    if (!access) return NextResponse.json({ error: "Paciente inválido." }, { status: 400 });
    if (!access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  }

  const type = String(body.type || "livre") as DocumentType;
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const title = String(body.title || "").trim() || DEFAULT_TITLE[type] || "Documento";
  let content = String(body.body || "");
  const medications = Array.isArray(body.medications)
    ? (body.medications as DocumentMedication[]).filter((m) => m?.name)
    : undefined;

  if (!content.trim() && !(medications && medications.length)) {
    return NextResponse.json({ error: "Escreva o conteúdo do documento." }, { status: 400 });
  }

  const patient = {
    name: String(body.patientName || access?.name || ""),
    cpf: String(body.patientCpf || ""),
    age: String(body.patientAge || ""),
    birthdate: String(body.patientBirthdate || access?.birthdate || ""),
  };

  content = fillPlaceholders(content, {
    patient,
    doctor: {
      name: doctor.name,
      crm: doctor.crm,
      rqe: doctor.rqe,
      specialty: doctor.specialty,
    },
    date: body.documentDate,
  });

  let letterhead = null;
  if (body.letterheadId && body.letterheadId !== "none") {
    letterhead = await getLetterhead(String(body.letterheadId), doctorId);
    if (!letterhead) {
      return NextResponse.json({ error: "Papel timbrado não encontrado." }, { status: 404 });
    }
  }

  const pdfBytes = await generateMedicalPdf({
    title,
    body: content,
    medications,
    patient,
    doctor: {
      name: doctor.name,
      crm: doctor.crm,
      rqe: doctor.rqe,
      specialty: doctor.specialty,
    },
    date: body.documentDate ? String(body.documentDate) : undefined,
    letterhead,
    signatureMethod: body.signOnGenerate === false ? "none" : "rubrica_texto",
    qrPayload: body.includeValidation ? `MR-${Date.now().toString(36)}` : null,
  });
  const pdfData = pdfToDataUrl(pdfBytes);

  if (action === "preview") {
    return NextResponse.json({ pdfData, title, type });
  }

  const shared = body.sharedWithPatient === true;
  const now = new Date().toISOString();
  const doc = await addDocument({
    patientEmail: access!.key,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorCrm: doctor.crm,
    type,
    title,
    body: content,
    sharedWithPatient: shared,
    letterheadId: letterhead?.id || null,
    pdfData,
    version: 1,
    status: body.signOnGenerate === false ? "final" : "signed",
    signatureMethod: body.signOnGenerate === false ? null : "rubrica_texto",
    signedAt: body.signOnGenerate === false ? null : now,
    signatureHash: createHash("sha256").update(pdfData).digest("hex").slice(0, 32),
    medications: medications || null,
    patientName: patient.name || null,
    patientCpf: patient.cpf || null,
    documentDate: body.documentDate ? String(body.documentDate).slice(0, 10) : now.slice(0, 10),
    history: [
      {
        at: now,
        actor: doctor.name,
        action: "criado",
        detail: letterhead ? `PDF gerado com timbrado “${letterhead.name}”` : "PDF gerado sem timbrado",
      },
      ...(shared
        ? [{ at: now, actor: doctor.name, action: "disponibilizado", detail: "Disponibilizado na área do paciente" }]
        : []),
    ],
  });

  if (shared) {
    await sendNotification({
      userId: patientKey(doc.patientEmail),
      role: "paciente",
      type: "documento_disponivel",
      title: "Novo documento disponível",
      body: `${doctor.name} disponibilizou um novo documento.`,
      targetUrl: `/paciente/documentos`,
      tag: `doc-${doc.id}`,
      relatedType: "document",
      relatedId: doc.id,
    }).catch(() => {});
  }

  return NextResponse.json({ document: sanitize(doc), pdfData }, { status: 201 });
}

function sanitize<T extends { pdfData?: string | null } | null>(doc: T) {
  if (!doc) return doc;
  const { pdfData: _p, ...rest } = doc;
  return { ...rest, hasPdf: Boolean(_p) };
}
