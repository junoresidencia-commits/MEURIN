import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { currentDocuments, type ConsentDocument, type ConsentType } from "./consent";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "consent.json");

const missingTables = new Set<string>();

function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}
function active(table: string) {
  return Boolean(getSupabaseAdmin()) && !missingTables.has(table);
}

export interface ConsentAcceptance {
  id: string;
  patientId?: string | null;
  patientEmail: string;
  patientCpf?: string | null;
  consentType: string;
  consentVersion: string;
  documentId?: string | null;
  documentSha256: string;
  accepted: boolean;
  acceptedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  operatingSystem?: string | null;
  device?: string | null;
  language?: string | null;
  screenResolution?: string | null;
  sessionId?: string | null;
  revoked: boolean;
  revokedAt?: string | null;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  userId?: string | null;
  patientId?: string | null;
  patientEmail?: string | null;
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

type FileShape = {
  documents: (ConsentDocument & { id: string; publishedAt: string })[];
  acceptances: ConsentAcceptance[];
  audit: AuditEntry[];
};

async function readFile(): Promise<FileShape> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const p = JSON.parse(raw) as Partial<FileShape>;
    return { documents: p.documents ?? [], acceptances: p.acceptances ?? [], audit: p.audit ?? [] };
  } catch {
    return { documents: [], acceptances: [], audit: [] };
  }
}
async function writeFile(data: FileShape) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

/** Garante que os documentos atuais estejam publicados; devolve type -> document_id. */
export async function ensureDocumentsPublished(): Promise<Map<ConsentType, string>> {
  const docs = currentDocuments();
  const ids = new Map<ConsentType, string>();

  if (active("consent_documents")) {
    const supabase = getSupabaseAdmin()!;
    for (const d of docs) {
      const { data, error } = await supabase
        .from("consent_documents")
        .select("id")
        .eq("type", d.type)
        .eq("version", d.version)
        .maybeSingle();
      if (error) {
        if (isMissingTableError(error)) {
          missingTables.add("consent_documents");
          break;
        }
        throw error;
      }
      if (data?.id) {
        ids.set(d.type, String(data.id));
      } else {
        const id = uuid();
        const { error: insErr } = await supabase.from("consent_documents").insert({
          id,
          type: d.type,
          version: d.version,
          title: d.title,
          body: d.body,
          sha256: d.sha256,
          published_at: new Date().toISOString(),
          active: true,
        });
        if (insErr) {
          if (isMissingTableError(insErr)) {
            missingTables.add("consent_documents");
            break;
          }
          throw insErr;
        }
        ids.set(d.type, id);
      }
    }
    if (ids.size === docs.length) return ids;
  }

  // Fallback local
  const file = await readFile();
  for (const d of docs) {
    let existing = file.documents.find((x) => x.type === d.type && x.version === d.version);
    if (!existing) {
      existing = { ...d, id: uuid(), publishedAt: new Date().toISOString() };
      file.documents.push(existing);
    }
    ids.set(d.type, existing.id);
  }
  await writeFile(file);
  return ids;
}

export async function listAcceptances(email: string): Promise<ConsentAcceptance[]> {
  const normalized = email.toLowerCase().trim();
  if (active("consent_acceptances")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("consent_acceptances")
      .select("*")
      .eq("patient_email", normalized)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTableError(error)) missingTables.add("consent_acceptances");
      else throw error;
    } else {
      return (data ?? []).map((r) => mapAcceptance(r as Record<string, unknown>));
    }
  }
  const file = await readFile();
  return file.acceptances
    .filter((a) => a.patientEmail === normalized)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mapAcceptance(r: Record<string, unknown>): ConsentAcceptance {
  return {
    id: String(r.id),
    patientId: (r.patient_id as string | null) ?? null,
    patientEmail: String(r.patient_email),
    patientCpf: (r.patient_cpf as string | null) ?? null,
    consentType: String(r.consent_type),
    consentVersion: String(r.consent_version),
    documentId: (r.document_id as string | null) ?? null,
    documentSha256: String(r.document_sha256),
    accepted: Boolean(r.accepted),
    acceptedAt: new Date(String(r.accepted_at)).toISOString(),
    ipAddress: (r.ip_address as string | null) ?? null,
    userAgent: (r.user_agent as string | null) ?? null,
    browser: (r.browser as string | null) ?? null,
    operatingSystem: (r.operating_system as string | null) ?? null,
    device: (r.device as string | null) ?? null,
    language: (r.language as string | null) ?? null,
    screenResolution: (r.screen_resolution as string | null) ?? null,
    sessionId: (r.session_id as string | null) ?? null,
    revoked: Boolean(r.revoked),
    revokedAt: r.revoked_at ? new Date(String(r.revoked_at)).toISOString() : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

/** Consentimentos ainda pendentes (não aceitos na versão atual) para o e-mail. */
export async function pendingConsents(email: string): Promise<ConsentType[]> {
  const docs = currentDocuments();
  const accepted = await listAcceptances(email);
  const validSet = new Set(
    accepted.filter((a) => a.accepted && !a.revoked).map((a) => `${a.consentType}@${a.consentVersion}`)
  );
  return docs.filter((d) => !validSet.has(`${d.type}@${d.version}`)).map((d) => d.type);
}

export type NewAcceptance = Omit<ConsentAcceptance, "id" | "createdAt" | "revoked" | "revokedAt">;

export async function recordAcceptance(input: NewAcceptance): Promise<ConsentAcceptance> {
  const row: ConsentAcceptance = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    revoked: false,
    revokedAt: null,
    ...input,
    patientEmail: input.patientEmail.toLowerCase().trim(),
  };

  if (active("consent_acceptances")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("consent_acceptances").insert({
      id: row.id,
      patient_id: row.patientId ?? null,
      patient_email: row.patientEmail,
      patient_cpf: row.patientCpf ?? null,
      consent_type: row.consentType,
      consent_version: row.consentVersion,
      document_id: row.documentId ?? null,
      document_sha256: row.documentSha256,
      accepted: row.accepted,
      accepted_at: row.acceptedAt,
      ip_address: row.ipAddress ?? null,
      user_agent: row.userAgent ?? null,
      browser: row.browser ?? null,
      operating_system: row.operatingSystem ?? null,
      device: row.device ?? null,
      language: row.language ?? null,
      screen_resolution: row.screenResolution ?? null,
      session_id: row.sessionId ?? null,
      revoked: false,
      revoked_at: null,
      created_at: row.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) missingTables.add("consent_acceptances");
      else throw error;
    } else {
      return row;
    }
  }

  const file = await readFile();
  file.acceptances.push(row);
  await writeFile(file);
  return row;
}

export async function revokeConsent(email: string, type: ConsentType): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const now = new Date().toISOString();
  if (active("consent_acceptances")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase
      .from("consent_acceptances")
      .update({ revoked: true, revoked_at: now })
      .eq("patient_email", normalized)
      .eq("consent_type", type)
      .eq("revoked", false);
    if (error && !isMissingTableError(error)) throw error;
    if (!error) return;
    missingTables.add("consent_acceptances");
  }
  const file = await readFile();
  file.acceptances = file.acceptances.map((a) =>
    a.patientEmail === normalized && a.consentType === type && !a.revoked
      ? { ...a, revoked: true, revokedAt: now }
      : a
  );
  await writeFile(file);
}

export async function addAudit(
  entry: Omit<AuditEntry, "id" | "createdAt">
): Promise<void> {
  const row: AuditEntry = { id: uuid(), createdAt: new Date().toISOString(), ...entry };
  if (active("audit_logs")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("audit_logs").insert({
      id: row.id,
      user_id: row.userId ?? null,
      patient_id: row.patientId ?? null,
      patient_email: row.patientEmail ?? null,
      action: row.action,
      table_name: row.tableName ?? null,
      record_id: row.recordId ?? null,
      ip_address: row.ipAddress ?? null,
      created_at: row.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) missingTables.add("audit_logs");
      else throw error;
    } else {
      return;
    }
  }
  const file = await readFile();
  file.audit.push(row);
  await writeFile(file);
}
