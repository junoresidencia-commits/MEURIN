import "server-only";
import { access, readFile } from "fs/promises";
import path from "path";
import { DOCUMENT_REGISTRY } from "./registry";
import { officialDocPages } from "@/lib/ceaf-documents";
import { CEAF_PROTOCOLS } from "@/lib/ceaf-catalog";
import { flagsFromEnv } from "./flags";
import { explainMissingIntegraIcpChannel, vidaasIntegraIcpReady } from "./signature";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type HealthFinding = {
  code: string;
  severity: "ok" | "warning" | "critical";
  label: string;
  count: number;
  detail?: string;
};

export type DocumentHealthReport = {
  at: string;
  findings: HealthFinding[];
  flags: ReturnType<typeof flagsFromEnv>;
  integraIcp: { ready: boolean; missing?: string };
};

async function fileExists(rel: string) {
  try {
    await access(path.join(process.cwd(), rel));
    return true;
  } catch {
    return false;
  }
}

type ScanDoc = {
  id?: string;
  patientEmail?: string | null;
  patient_email?: string | null;
  doctorId?: string | null;
  doctor_id?: string | null;
  pdfPath?: string | null;
  pdf_path?: string | null;
  status?: string | null;
  signatureMethod?: string | null;
  signature_method?: string | null;
};

function scanRows(rows: ScanDoc[]): { orphanPatient: number; orphanDoctor: number; signedWithoutFile: number; invalidState: number } {
  let orphanPatient = 0;
  let orphanDoctor = 0;
  let signedWithoutFile = 0;
  let invalidState = 0;
  for (const d of rows) {
    const patient = String(d.patientEmail || d.patient_email || "").trim();
    const doctor = String(d.doctorId || d.doctor_id || "").trim();
    const pdf = String(d.pdfPath || d.pdf_path || "").trim();
    const status = String(d.status || "");
    const method = String(d.signatureMethod || d.signature_method || "");
    if (!patient) orphanPatient += 1;
    if (!doctor) orphanDoctor += 1;
    if (status === "signed" && !pdf) signedWithoutFile += 1;
    if (status === "signed" && method === "certificada" && !pdf) invalidState += 1;
  }
  return { orphanPatient, orphanDoctor, signedWithoutFile, invalidState };
}

async function scanStoredDocuments(): Promise<ReturnType<typeof scanRows>> {
  const acc = { orphanPatient: 0, orphanDoctor: 0, signedWithoutFile: 0, invalidState: 0 };
  const add = (part: ReturnType<typeof scanRows>) => {
    acc.orphanPatient += part.orphanPatient;
    acc.orphanDoctor += part.orphanDoctor;
    acc.signedWithoutFile += part.signedWithoutFile;
    acc.invalidState += part.invalidState;
  };
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "patient-records.json"), "utf8");
    const parsed = JSON.parse(raw) as { documents?: ScanDoc[] };
    add(scanRows(parsed.documents || []));
  } catch {
    /* demo file ausente = zero documentos */
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("documents")
      .select("id,patient_email,doctor_id,pdf_path,status,signature_method")
      .limit(8000);
    if (!error && data) add(scanRows(data as ScanDoc[]));
  }
  return acc;
}

/** DocumentHealthCheck — não altera dados. Só lê. */
export async function runDocumentHealthCheck(): Promise<DocumentHealthReport> {
  const findings: HealthFinding[] = [];
  let missingTemplates = 0;
  for (const def of DOCUMENT_REGISTRY.filter((d) => d.active)) {
    for (const p of def.integrityPaths) {
      if (!(await fileExists(p))) {
        missingTemplates += 1;
        findings.push({
          code: "template_missing",
          severity: "critical",
          label: `Caminho ausente para ${def.name}`,
          count: 1,
          detail: p,
        });
      }
    }
  }

  let officialWithoutVersion = 0;
  for (const p of CEAF_PROTOCOLS) {
    if (p.requiresTer && !officialDocPages(p.id, "ter") && p.id !== "sindrome_nefrotica_adultos") {
      officialWithoutVersion += 1;
    }
  }

  findings.push({
    code: "official_ter_adult_sn",
    severity: "warning",
    label: "TER de síndrome nefrótica em adultos ausente no pacote SESAB (esperado)",
    count: officialDocPages("sindrome_nefrotica_adultos", "ter") ? 0 : 1,
    detail: "Não substituímos pelo TER pediátrico.",
  });

  findings.push({
    code: "registry_paths",
    severity: missingTemplates ? "critical" : "ok",
    label: "Templates / arquivos do registry",
    count: missingTemplates,
  });

  findings.push({
    code: "official_without_pack",
    severity: officialWithoutVersion ? "warning" : "ok",
    label: "Protocolos oficiais sem TER no pacote",
    count: officialWithoutVersion,
  });

  const stored = await scanStoredDocuments().catch(() => ({
    orphanPatient: 0,
    orphanDoctor: 0,
    signedWithoutFile: 0,
    invalidState: 0,
  }));

  findings.push({
    code: "orphan_documents",
    severity: stored.orphanPatient ? "critical" : "ok",
    label: "Documentos órfãos (sem paciente)",
    count: stored.orphanPatient,
  });
  findings.push({
    code: "orphan_doctor",
    severity: stored.orphanDoctor ? "warning" : "ok",
    label: "Documentos sem médico",
    count: stored.orphanDoctor,
  });
  findings.push({
    code: "signed_without_file",
    severity: stored.signedWithoutFile ? "critical" : "ok",
    label: "Registro assinado sem arquivo",
    count: stored.signedWithoutFile,
  });
  findings.push({
    code: "impossible_state",
    severity: stored.invalidState ? "critical" : "ok",
    label: "Estado impossível (assinado digital sem PDF)",
    count: stored.invalidState,
  });

  const flags = flagsFromEnv();
  const ready = vidaasIntegraIcpReady();
  findings.push({
    code: "integraicp_channel",
    severity: "ok",
    label: ready ? "IntegraICP Channel configurado" : "IntegraICP Channel ausente (fallback gov.br/VIDaaS ativo)",
    count: ready ? 0 : 1,
    detail: ready ? undefined : explainMissingIntegraIcpChannel(),
  });

  return {
    at: new Date().toISOString(),
    findings,
    flags,
    integraIcp: ready ? { ready: true } : { ready: false, missing: explainMissingIntegraIcpChannel() },
  };
}
