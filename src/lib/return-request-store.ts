import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import type {
  LastVisitApprox,
  LastVisitSource,
  ReturnDecision,
  ReturnEvent,
  ReturnMessage,
  ReturnProfessionalKind,
  ReturnRequest,
  ReturnRequestStatus,
} from "./return-request-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "return-requests.json");
const missing = new Set<string>();

type LocalDb = { requests: ReturnRequest[]; messages: ReturnMessage[]; events: ReturnEvent[] };

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
function active(table: string) {
  return Boolean(getSupabaseAdmin()) && !missing.has(table);
}

async function readLocal(): Promise<LocalDb> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
    return {
      requests: Array.isArray(raw.requests) ? raw.requests : [],
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      events: Array.isArray(raw.events) ? raw.events : [],
    };
  } catch {
    return { requests: [], messages: [], events: [] };
  }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapRequest(r: Record<string, unknown>): ReturnRequest {
  return {
    id: String(r.id),
    professionalKind: (r.professional_kind || r.professionalKind) as ReturnProfessionalKind,
    professionalId: String(r.professional_id ?? r.professionalId),
    professionalName: String(r.professional_name ?? r.professionalName),
    professionalSpecialty: (r.professional_specialty as string | null) ?? (r.professionalSpecialty as string | null) ?? null,
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: String(r.patient_name ?? r.patientName),
    patientEmail: (r.patient_email as string | null) ?? (r.patientEmail as string | null) ?? null,
    requestedSlotStart: new Date(String(r.requested_slot_start ?? r.requestedSlotStart)).toISOString(),
    requestedSlotEnd: new Date(String(r.requested_slot_end ?? r.requestedSlotEnd)).toISOString(),
    requestedKind: "retorno",
    status: (r.status as ReturnRequestStatus) || "pending_review",
    lastVisitAt: r.last_visit_at || r.lastVisitAt ? new Date(String(r.last_visit_at ?? r.lastVisitAt)).toISOString() : null,
    lastVisitSource: ((r.last_visit_source ?? r.lastVisitSource) as LastVisitSource | null) ?? null,
    lastVisitLocation: (r.last_visit_location as string | null) ?? (r.lastVisitLocation as string | null) ?? null,
    lastVisitApprox: ((r.last_visit_approx ?? r.lastVisitApprox) as LastVisitApprox | null) ?? null,
    daysSinceLast: r.days_since_last != null ? Number(r.days_since_last) : r.daysSinceLast != null ? Number(r.daysSinceLast) : null,
    withinHabitual: r.within_habitual != null ? Boolean(r.within_habitual) : r.withinHabitual != null ? Boolean(r.withinHabitual) : null,
    patientNote: (r.patient_note as string | null) ?? (r.patientNote as string | null) ?? null,
    suggestedSlotStart: r.suggested_slot_start || r.suggestedSlotStart ? new Date(String(r.suggested_slot_start ?? r.suggestedSlotStart)).toISOString() : null,
    suggestedSlotEnd: r.suggested_slot_end || r.suggestedSlotEnd ? new Date(String(r.suggested_slot_end ?? r.suggestedSlotEnd)).toISOString() : null,
    decision: ((r.decision as ReturnDecision | null) ?? null),
    decisionBy: (r.decision_by as string | null) ?? (r.decisionBy as string | null) ?? null,
    decisionAt: r.decision_at || r.decisionAt ? new Date(String(r.decision_at ?? r.decisionAt)).toISOString() : null,
    refusalReason: (r.refusal_reason as string | null) ?? (r.refusalReason as string | null) ?? null,
    autoMessage: (r.auto_message as string | null) ?? (r.autoMessage as string | null) ?? null,
    exceptionalAfter30: r.exceptional_after_30 === true || r.exceptionalAfter30 === true,
    convertedToNew: r.converted_to_new === true || r.convertedToNew === true,
    bookingId: (r.booking_id as string | null) ?? (r.bookingId as string | null) ?? null,
    priceCents: r.price_cents != null ? Number(r.price_cents) : r.priceCents != null ? Number(r.priceCents) : null,
    paymentStatus: (r.payment_status as string | null) ?? (r.paymentStatus as string | null) ?? null,
    chatOpen: r.chat_open !== false && r.chatOpen !== false,
    attendantInvited: r.attendant_invited === true || r.attendantInvited === true,
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
    updatedAt: new Date(String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt)).toISOString(),
    closedAt: r.closed_at || r.closedAt ? new Date(String(r.closed_at ?? r.closedAt)).toISOString() : null,
  };
}

function rowFrom(req: ReturnRequest): Record<string, unknown> {
  return {
    id: req.id,
    professional_kind: req.professionalKind,
    professional_id: req.professionalId,
    professional_name: req.professionalName,
    professional_specialty: req.professionalSpecialty ?? null,
    patient_key: req.patientKey,
    patient_name: req.patientName,
    patient_email: req.patientEmail ?? null,
    requested_slot_start: req.requestedSlotStart,
    requested_slot_end: req.requestedSlotEnd,
    requested_kind: "retorno",
    status: req.status,
    last_visit_at: req.lastVisitAt ?? null,
    last_visit_source: req.lastVisitSource ?? null,
    last_visit_location: req.lastVisitLocation ?? null,
    last_visit_approx: req.lastVisitApprox ?? null,
    days_since_last: req.daysSinceLast ?? null,
    within_habitual: req.withinHabitual ?? null,
    patient_note: req.patientNote ?? null,
    suggested_slot_start: req.suggestedSlotStart ?? null,
    suggested_slot_end: req.suggestedSlotEnd ?? null,
    decision: req.decision ?? null,
    decision_by: req.decisionBy ?? null,
    decision_at: req.decisionAt ?? null,
    refusal_reason: req.refusalReason ?? null,
    auto_message: req.autoMessage ?? null,
    exceptional_after_30: req.exceptionalAfter30 === true,
    converted_to_new: req.convertedToNew === true,
    booking_id: req.bookingId ?? null,
    price_cents: req.priceCents ?? null,
    payment_status: req.paymentStatus ?? null,
    chat_open: req.chatOpen !== false,
    attendant_invited: req.attendantInvited === true,
    created_at: req.createdAt,
    updated_at: req.updatedAt,
    closed_at: req.closedAt ?? null,
  };
}

function mapMessage(r: Record<string, unknown>): ReturnMessage {
  return {
    id: String(r.id),
    requestId: String(r.request_id ?? r.requestId),
    authorRole: (r.author_role || r.authorRole) as ReturnMessage["authorRole"],
    authorId: String(r.author_id ?? r.authorId),
    authorName: String(r.author_name ?? r.authorName),
    body: String(r.body || ""),
    attachmentName: (r.attachment_name as string | null) ?? (r.attachmentName as string | null) ?? null,
    attachmentPath: (r.attachment_path as string | null) ?? (r.attachmentPath as string | null) ?? null,
    attachmentMime: (r.attachment_mime as string | null) ?? (r.attachmentMime as string | null) ?? null,
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
  };
}

function mapEvent(r: Record<string, unknown>): ReturnEvent {
  return {
    id: String(r.id),
    requestId: String(r.request_id ?? r.requestId),
    at: new Date(String(r.at)).toISOString(),
    actor: String(r.actor),
    type: String(r.type),
    detail: (r.detail as string | null) ?? null,
  };
}

export async function createReturnRequest(
  input: Omit<ReturnRequest, "id" | "createdAt" | "updatedAt" | "chatOpen" | "attendantInvited" | "requestedKind" | "exceptionalAfter30" | "convertedToNew"> & Partial<Pick<ReturnRequest, "chatOpen" | "attendantInvited">>
): Promise<ReturnRequest> {
  const now = new Date().toISOString();
  const req: ReturnRequest = {
    ...input,
    id: uuid(),
    requestedKind: "retorno",
    chatOpen: input.chatOpen !== false,
    attendantInvited: input.attendantInvited === true,
    exceptionalAfter30: false,
    convertedToNew: false,
    createdAt: now,
    updatedAt: now,
  };
  if (active("return_requests")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("return_requests").insert(rowFrom(req));
    if (!isMissing(error)) {
      if (error) throw error;
      await addReturnEvent(req.id, "paciente", "solicitada", "Paciente solicitou retorno. Horário ainda não reservado.");
      return req;
    }
    missing.add("return_requests");
  }
  const db = await readLocal();
  db.requests.unshift(req);
  await writeLocal(db);
  await addReturnEvent(req.id, "paciente", "solicitada", "Paciente solicitou retorno. Horário ainda não reservado.");
  return req;
}

export async function getReturnRequest(id: string): Promise<ReturnRequest | null> {
  if (active("return_requests")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("return_requests").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapRequest(data as Record<string, unknown>) : null;
    if (isMissing(error)) missing.add("return_requests");
  }
  return (await readLocal()).requests.find((r) => r.id === id) || null;
}

export async function listReturnRequestsForPatient(patientKey: string): Promise<ReturnRequest[]> {
  const key = patientKey.toLowerCase().trim();
  if (active("return_requests")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("return_requests")
      .select("*")
      .eq("patient_key", key)
      .order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data || []).map((r) => mapRequest(r as Record<string, unknown>));
    if (isMissing(error)) missing.add("return_requests");
  }
  return (await readLocal()).requests
    .filter((r) => r.patientKey.toLowerCase() === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listReturnRequestsForProfessional(
  kind: ReturnProfessionalKind,
  professionalId: string
): Promise<ReturnRequest[]> {
  if (active("return_requests")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("return_requests")
      .select("*")
      .eq("professional_kind", kind)
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data || []).map((r) => mapRequest(r as Record<string, unknown>));
    if (isMissing(error)) missing.add("return_requests");
  }
  return (await readLocal()).requests
    .filter((r) => r.professionalKind === kind && r.professionalId === professionalId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listReturnRequestsForDoctors(doctorIds: string[]): Promise<ReturnRequest[]> {
  const ids = new Set(doctorIds);
  if (ids.size === 0) return [];
  if (active("return_requests")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("return_requests")
      .select("*")
      .eq("professional_kind", "doctor")
      .in("professional_id", [...ids])
      .order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data || []).map((r) => mapRequest(r as Record<string, unknown>));
    if (isMissing(error)) missing.add("return_requests");
  }
  return (await readLocal()).requests
    .filter((r) => r.professionalKind === "doctor" && ids.has(r.professionalId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateReturnRequest(id: string, patch: Partial<ReturnRequest>): Promise<ReturnRequest | null> {
  const current = await getReturnRequest(id);
  if (!current) return null;
  const next: ReturnRequest = { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() };
  if (active("return_requests")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("return_requests").update(rowFrom(next)).eq("id", id);
    if (!isMissing(error)) {
      if (error) throw error;
      return next;
    }
    missing.add("return_requests");
  }
  const db = await readLocal();
  db.requests = db.requests.map((r) => (r.id === id ? next : r));
  await writeLocal(db);
  return next;
}

export async function addReturnEvent(requestId: string, actor: string, type: string, detail?: string): Promise<ReturnEvent> {
  const ev: ReturnEvent = { id: uuid(), requestId, at: new Date().toISOString(), actor, type, detail: detail || null };
  if (active("return_request_events")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("return_request_events").insert({
      id: ev.id, request_id: requestId, at: ev.at, actor, type, detail: ev.detail,
    });
    if (!isMissing(error) && !error) return ev;
    if (isMissing(error)) missing.add("return_request_events");
  }
  const db = await readLocal();
  db.events.push(ev);
  await writeLocal(db);
  return ev;
}

export async function listReturnEvents(requestId: string): Promise<ReturnEvent[]> {
  if (active("return_request_events")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("return_request_events")
      .select("*")
      .eq("request_id", requestId)
      .order("at", { ascending: true });
    if (!isMissing(error) && !error) return (data || []).map((r) => mapEvent(r as Record<string, unknown>));
    if (isMissing(error)) missing.add("return_request_events");
  }
  return (await readLocal()).events.filter((e) => e.requestId === requestId).sort((a, b) => a.at.localeCompare(b.at));
}

export async function addReturnMessage(input: Omit<ReturnMessage, "id" | "createdAt">): Promise<ReturnMessage> {
  const msg: ReturnMessage = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  if (active("return_request_messages")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("return_request_messages").insert({
      id: msg.id,
      request_id: msg.requestId,
      author_role: msg.authorRole,
      author_id: msg.authorId,
      author_name: msg.authorName,
      body: msg.body,
      attachment_name: msg.attachmentName ?? null,
      attachment_path: msg.attachmentPath ?? null,
      attachment_mime: msg.attachmentMime ?? null,
      created_at: msg.createdAt,
    });
    if (!isMissing(error) && !error) return msg;
    if (isMissing(error)) missing.add("return_request_messages");
  }
  const db = await readLocal();
  db.messages.push(msg);
  await writeLocal(db);
  return msg;
}

export async function listReturnMessages(requestId: string): Promise<ReturnMessage[]> {
  if (active("return_request_messages")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("return_request_messages")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (!isMissing(error) && !error) return (data || []).map((r) => mapMessage(r as Record<string, unknown>));
    if (isMissing(error)) missing.add("return_request_messages");
  }
  return (await readLocal()).messages.filter((m) => m.requestId === requestId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
