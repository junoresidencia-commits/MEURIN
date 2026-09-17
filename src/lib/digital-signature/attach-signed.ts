import "server-only";
import { createHash } from "crypto";
import { v4 as uuid } from "uuid";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import {
  addDocument,
  getDocumentsByGroup,
  updateDocument,
  type ClinicalDocument,
} from "@/lib/patient-store";
import { DOCPDF_BUCKET, saveFile } from "@/lib/doc-storage";
import { writeAudit } from "@/lib/patient-shares-store";
import {
  getDigitalSignatureProvider,
  isDigitalSignatureProviderId,
  type DigitalSignatureProviderId,
} from "@/lib/digital-signature/providers";

export const SIGNED_PDF_MAX_BYTES = 12 * 1024 * 1024;

export type AttachSignedResult = {
  original: ClinicalDocument | null;
  signed: ClinicalDocument;
};

function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function parseSignedPdfUpload(file: File | null, size: number): string | null {
  if (!file) return "Envie o PDF já assinado.";
  const type = file.type || "";
  if (!type.includes("pdf") && !/\.pdf$/i.test(file.name)) return "Envie um arquivo PDF.";
  if (size > SIGNED_PDF_MAX_BYTES) return "Arquivo muito grande (máx. 12 MB).";
  return null;
}

async function nextVersion(groupId: string, fallback: number): Promise<number> {
  const versions = await getDocumentsByGroup(groupId);
  const max = versions.reduce((acc, d) => Math.max(acc, d.version ?? 1), fallback);
  return max + 1;
}

function crmUf(doctorCrm: string | null | undefined, crm: string | null | undefined, crmState: string | null | undefined) {
  const existing = (doctorCrm || "").trim();
  if (existing) return existing;
  return [crm, crmState].filter(Boolean).join("-") || null;
}

/**
 * Guarda o PDF original intacto e cria uma nova versão (mesmo groupId) com o
 * arquivo assinado. Não altera login, pacientes, agenda nem o schema.
 */
export async function attachSignedPdf(opts: {
  doctorId: string;
  providerId: DigitalSignatureProviderId | "manual";
  buffer: Buffer;
  filename: string;
  original?: ClinicalDocument | null;
  patientKey?: string;
  type?: string;
  title?: string;
  signatureMethod?: "certificada" | "imagem";
}): Promise<AttachSignedResult> {
  if (!isPdfBuffer(opts.buffer)) {
    throw new Error("O arquivo não parece um PDF válido.");
  }
  const method = opts.signatureMethod || (opts.providerId === "manual" ? "imagem" : "certificada");
  const provider =
    opts.providerId === "manual" || method === "imagem"
      ? { id: "manual" as const }
      : getDigitalSignatureProvider(opts.providerId);
  if (!provider) throw new Error("Provedor de assinatura inválido.");

  const doctor = await getDoctorById(opts.doctorId);
  if (!doctor) throw new Error("Médico não encontrado.");

  const original = opts.original ?? null;
  let patientKey = (opts.patientKey || original?.patientEmail || "").trim();
  if (!patientKey) throw new Error("Informe o paciente para guardar o PDF assinado no prontuário.");

  const access = await resolvePatientAccess(patientKey);
  if (!access || !access.allowed) throw new Error("Sem acesso a este paciente.");
  patientKey = access.key;

  if (original && original.doctorId !== opts.doctorId) {
    throw new Error("Documento não encontrado.");
  }

  let groupId = original?.groupId || original?.id || uuid();
  if (original && !original.groupId) {
    const patched = await updateDocument(original.id, { groupId });
    if (patched) groupId = patched.groupId || groupId;
  }

  const version = await nextVersion(groupId, original?.version ?? 1);
  const saved = await saveFile(DOCPDF_BUCKET, opts.doctorId, {
    name: opts.filename || `${opts.type || original?.type || "documento"}-assinado.pdf`,
    type: "application/pdf",
    buffer: opts.buffer,
  });
  const hash = createHash("sha256").update(opts.buffer).digest("hex");
  const now = new Date().toISOString();
  const by = doctor.name;
  const crm = crmUf(original?.doctorCrm, doctor.crm, doctor.crmState);
  const type = opts.type || original?.type || "livre";
  const title = (opts.title || original?.title || "Documento").trim();

  const signed = await addDocument({
    patientEmail: patientKey,
    doctorId: opts.doctorId,
    doctorName: doctor.name,
    doctorCrm: crm,
    type,
    title,
    body: original?.body || "",
    sharedWithPatient: false,
    letterheadId: original?.letterheadId ?? null,
    pdfPath: saved.path,
    pdfStorage: saved.storage,
    status: "signed",
    version,
    groupId,
    signedAt: now,
    signedBy: by,
    signatureMethod: method,
    signatureHash: hash,
    history: [
      {
        at: now,
        by,
        action: "assinado",
        detail: `${method} via ${provider.id} · CRM ${crm || "—"} · original:${original?.id || "avulso"} · sha256 ${hash.slice(0, 12)}…`,
      },
    ],
  });

  try {
    await writeAudit({
      doctorId: opts.doctorId,
      doctorName: doctor.name,
      patientKey,
      action: method === "imagem" ? "documento_assinado_manual" : "documento_assinado_digital",
      detail: `${type}: ${title} (${provider.id})`,
    });
  } catch {
    /* auditoria best-effort */
  }

  return { original, signed };
}

export function requireProviderId(raw: string): DigitalSignatureProviderId {
  const id = raw.trim().toLowerCase();
  if (!isDigitalSignatureProviderId(id)) {
    throw new Error("Escolha CFM Digital ou VIDaaS.");
  }
  return id;
}
