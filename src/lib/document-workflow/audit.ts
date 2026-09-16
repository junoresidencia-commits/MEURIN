import "server-only";
import { writeAudit } from "@/lib/patient-shares-store";
import { DOCUMENT_AUDIT_EVENTS, type DocumentAuditEvent } from "./audit-events";

export { DOCUMENT_AUDIT_EVENTS, type DocumentAuditEvent };

export async function logDocumentEvent(input: {
  event: DocumentAuditEvent;
  doctorId: string;
  doctorName?: string | null;
  patientKey?: string | null;
  documentId?: string | null;
  detail?: string | null;
}): Promise<void> {
  const bits = [input.event, input.documentId ? `doc:${input.documentId}` : null, input.detail]
    .filter(Boolean)
    .join(" · ");
  try {
    await writeAudit({
      doctorId: input.doctorId,
      doctorName: input.doctorName,
      patientKey: input.patientKey,
      action: input.event,
      detail: bits.slice(0, 240),
    });
  } catch {
    /* auditoria best-effort */
  }
}
