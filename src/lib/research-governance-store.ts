import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { writeAudit } from "./platform-store";
import { listStudies } from "./research-studies-store";
import {
  canExportStudy,
  emptyProtocol,
  type ConsentStatus,
  type EthicsStatus,
  type ExportGate,
  type ResearchConsent,
  type ResearchProtocol,
} from "./research-governance";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "research-governance.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type ExportLog = { id: string; studyId: string; doctorId: string; format: string; rowCount: number; createdAt: string };
type LocalDb = { protocols: ResearchProtocol[]; consents: ResearchConsent[]; exports: ExportLog[] };

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { protocols: [], consents: [], exports: [] };
  }
}
async function writeLocal(db: LocalDb) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[research-gov] persistência local indisponível", err);
  }
}

function mapProtocol(r: Record<string, unknown>): ResearchProtocol {
  return {
    id: String(r.id),
    studyId: String(r.study_id ?? r.studyId),
    doctorId: String(r.doctor_id ?? r.doctorId),
    clinicId: (r.clinic_id as string) ?? (r.clinicId as string) ?? null,
    ethicsStatus: (String(r.ethics_status ?? r.ethicsStatus ?? "none") as EthicsStatus),
    protocolCode: (r.protocol_code as string) ?? (r.protocolCode as string) ?? null,
    ethicsBody: (r.ethics_body as string) ?? (r.ethicsBody as string) ?? null,
    waiverReason: (r.waiver_reason as string) ?? (r.waiverReason as string) ?? null,
    approvedAt: (r.approved_at as string) ?? (r.approvedAt as string) ?? null,
    notes: (r.notes as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}
function mapConsent(r: Record<string, unknown>): ResearchConsent {
  return {
    id: String(r.id),
    studyId: String(r.study_id ?? r.studyId),
    doctorId: String(r.doctor_id ?? r.doctorId),
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: (r.patient_name as string) ?? (r.patientName as string) ?? null,
    status: (String(r.status || "pending") as ConsentStatus),
    recordedAt: String(r.recorded_at ?? r.recordedAt),
  };
}

export async function getProtocol(studyId: string, doctorId: string): Promise<ResearchProtocol> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("research_protocols").select("*").eq("study_id", studyId).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return emptyProtocol(studyId, doctorId);
    } else if (data) {
      const row = mapProtocol(data as Record<string, unknown>);
      return row.doctorId === doctorId ? row : emptyProtocol(studyId, doctorId);
    } else {
      return emptyProtocol(studyId, doctorId);
    }
  }
  const found = (await readLocal()).protocols.find((p) => p.studyId === studyId && p.doctorId === doctorId);
  return found || emptyProtocol(studyId, doctorId);
}

export async function upsertProtocol(input: {
  studyId: string;
  doctorId: string;
  clinicId?: string | null;
  ethicsStatus: EthicsStatus;
  protocolCode?: string | null;
  ethicsBody?: string | null;
  waiverReason?: string | null;
  notes?: string | null;
}): Promise<ResearchProtocol> {
  const current = await getProtocol(input.studyId, input.doctorId);
  const now = new Date().toISOString();
  const approvedAt =
    input.ethicsStatus === "approved" || input.ethicsStatus === "waived"
      ? current.approvedAt || now
      : null;
  const row: ResearchProtocol = {
    id: current.id || uuid(),
    studyId: input.studyId,
    doctorId: input.doctorId,
    clinicId: input.clinicId ?? current.clinicId,
    ethicsStatus: input.ethicsStatus,
    protocolCode: input.protocolCode?.trim() || null,
    ethicsBody: input.ethicsBody?.trim() || null,
    waiverReason: input.waiverReason?.trim() || null,
    approvedAt,
    notes: input.notes?.trim() || null,
    createdAt: current.id ? current.createdAt : now,
    updatedAt: now,
  };

  if (active()) {
    const sb = getSupabaseAdmin()!;
    const payload = {
      id: row.id,
      study_id: row.studyId,
      doctor_id: row.doctorId,
      clinic_id: row.clinicId,
      ethics_status: row.ethicsStatus,
      protocol_code: row.protocolCode,
      ethics_body: row.ethicsBody,
      waiver_reason: row.waiverReason,
      approved_at: row.approvedAt,
      notes: row.notes,
      updated_at: row.updatedAt,
      created_at: row.createdAt,
    };
    const { error } = current.id
      ? await sb.from("research_protocols").update(payload).eq("id", row.id)
      : await sb.from("research_protocols").insert(payload);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) {
      await writeAudit({
        actorKind: "doctor",
        actorId: input.doctorId,
        actorEmail: null,
        action: "research_protocol",
        entity: "research_protocol",
        entityId: row.id,
        detail: `Ética ${row.ethicsStatus}. Sem mover paciente.`,
      });
      return row;
    }
  }

  const local = await readLocal();
  const idx = local.protocols.findIndex((p) => p.studyId === row.studyId);
  if (idx >= 0) local.protocols[idx] = row;
  else local.protocols.push(row);
  await writeLocal(local);
  return row;
}

export async function listConsents(studyId: string, doctorId: string): Promise<ResearchConsent[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("research_consents")
      .select("*")
      .eq("study_id", studyId)
      .eq("doctor_id", doctorId)
      .order("recorded_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapConsent(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).consents
    .filter((c) => c.studyId === studyId && c.doctorId === doctorId)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function upsertConsent(input: {
  studyId: string;
  doctorId: string;
  patientKey: string;
  patientName?: string | null;
  status: ConsentStatus;
}): Promise<ResearchConsent> {
  const key = input.patientKey.toLowerCase().trim();
  const now = new Date().toISOString();
  const existing = (await listConsents(input.studyId, input.doctorId)).find((c) => c.patientKey === key);
  const row: ResearchConsent = {
    id: existing?.id || uuid(),
    studyId: input.studyId,
    doctorId: input.doctorId,
    patientKey: key,
    patientName: input.patientName ?? existing?.patientName ?? null,
    status: input.status,
    recordedAt: now,
  };

  if (active()) {
    const sb = getSupabaseAdmin()!;
    const payload = {
      id: row.id,
      study_id: row.studyId,
      doctor_id: row.doctorId,
      patient_key: row.patientKey,
      patient_name: row.patientName,
      status: row.status,
      recorded_at: row.recordedAt,
    };
    const { error } = existing
      ? await sb.from("research_consents").update(payload).eq("id", row.id)
      : await sb.from("research_consents").insert(payload);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }

  const local = await readLocal();
  const idx = local.consents.findIndex((c) => c.studyId === row.studyId && c.patientKey === key);
  if (idx >= 0) local.consents[idx] = row;
  else local.consents.push(row);
  await writeLocal(local);
  return row;
}

export async function exportGate(studyId: string, doctorId: string, studyType?: string): Promise<ExportGate> {
  const protocol = await getProtocol(studyId, doctorId);
  const consents = await listConsents(studyId, doctorId);
  return canExportStudy({
    ethicsStatus: protocol.ethicsStatus,
    protocolCode: protocol.protocolCode,
    waiverReason: protocol.waiverReason,
    studyType,
    givenConsents: consents.filter((c) => c.status === "given").length,
  });
}

export async function logExport(input: {
  studyId: string;
  doctorId: string;
  format: string;
  rowCount: number;
}): Promise<void> {
  const row: ExportLog = {
    id: uuid(),
    studyId: input.studyId,
    doctorId: input.doctorId,
    format: input.format,
    rowCount: input.rowCount,
    createdAt: new Date().toISOString(),
  };
  try {
    if (active()) {
      const sb = getSupabaseAdmin()!;
      const { error } = await sb.from("research_export_log").insert({
        id: row.id,
        study_id: row.studyId,
        doctor_id: row.doctorId,
        format: row.format,
        row_count: row.rowCount,
        created_at: row.createdAt,
      });
      if (error && !isMissing(error)) {
        console.error("[research-gov] export log", error);
        return;
      }
      if (error && isMissing(error)) tableMissing = true;
      else if (!error) return;
    }
    const local = await readLocal();
    local.exports.unshift(row);
    local.exports = local.exports.slice(0, 500);
    await writeLocal(local);
  } catch (err) {
    console.error("[research-gov] export log ignorado", err);
  }
}

export async function listPlatformProtocols(): Promise<
  Array<ResearchProtocol & { studyTitle: string; doctorId: string }>
> {
  const local = await readLocal();
  const protocols = [...local.protocols];
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("research_protocols").select("*").order("updated_at", { ascending: false });
    if (!error) {
      const rows = (data || []).map((r) => mapProtocol(r as Record<string, unknown>));
      return Promise.all(
        rows.map(async (p) => {
          const studies = await listStudies(p.doctorId);
          return { ...p, studyTitle: studies.find((s) => s.id === p.studyId)?.title || "Estudo" };
        })
      );
    }
    if (isMissing(error)) tableMissing = true;
  }
  const out = [];
  for (const p of protocols) {
    const studies = await listStudies(p.doctorId);
    out.push({ ...p, studyTitle: studies.find((s) => s.id === p.studyId)?.title || "Estudo" });
  }
  return out;
}
