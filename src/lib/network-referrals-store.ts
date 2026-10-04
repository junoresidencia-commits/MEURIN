import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import {
  DEFAULT_SHARE_SLICES,
  isShareSlice,
  type ConsentMethod,
  type PatientNetworkReferral,
  type PatientNetworkReferralEvent,
  type PatientProfessionalLink,
  type ProfessionalKind,
  type ReferralStatus,
  type ShareSlice,
} from "./network-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "network-referrals.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = {
  referrals: PatientNetworkReferral[];
  events: PatientNetworkReferralEvent[];
  links: PatientProfessionalLink[];
};

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { referrals: [], events: [], links: [] };
  }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function slicesOf(value: unknown): ShareSlice[] {
  if (!Array.isArray(value)) return [...DEFAULT_SHARE_SLICES];
  const next = value.filter(isShareSlice);
  return next.length ? next : [...DEFAULT_SHARE_SLICES];
}

function mapReferral(r: Record<string, unknown>): PatientNetworkReferral {
  return {
    id: String(r.id),
    patientKey: String(r.patient_key ?? r.patientKey ?? ""),
    patientName: (r.patient_name as string) ?? (r.patientName as string) ?? null,
    registeredByKind: (r.registered_by_kind as ProfessionalKind) ?? (r.registeredByKind as ProfessionalKind) ?? null,
    registeredById: (r.registered_by_id as string) ?? (r.registeredById as string) ?? null,
    registeredByName: (r.registered_by_name as string) ?? (r.registeredByName as string) ?? null,
    fromKind: (r.from_kind as ProfessionalKind) ?? (r.fromKind as ProfessionalKind),
    fromId: String(r.from_id ?? r.fromId),
    fromName: String(r.from_name ?? r.fromName ?? ""),
    fromProfession: (r.from_profession as string) ?? (r.fromProfession as string) ?? null,
    fromSpecialty: (r.from_specialty as string) ?? (r.fromSpecialty as string) ?? null,
    toKind: (r.to_kind as ProfessionalKind) ?? (r.toKind as ProfessionalKind),
    toId: String(r.to_id ?? r.toId),
    toName: String(r.to_name ?? r.toName ?? ""),
    toProfession: (r.to_profession as string) ?? (r.toProfession as string) ?? null,
    toSpecialty: (r.to_specialty as string) ?? (r.toSpecialty as string) ?? null,
    reason: (r.reason as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: ((r.status as ReferralStatus) || "pending"),
    shareSlices: slicesOf(r.share_slices ?? r.shareSlices),
    consentConfirmed: r.consent_confirmed === true || r.consentConfirmed === true,
    consentMethod: (r.consent_method as ConsentMethod) ?? (r.consentMethod as ConsentMethod) ?? null,
    consentAt: (r.consent_at as string) ?? (r.consentAt as string) ?? null,
    consentByKind: (r.consent_by_kind as string) ?? (r.consentByKind as string) ?? null,
    consentById: (r.consent_by_id as string) ?? (r.consentById as string) ?? null,
    consentByName: (r.consent_by_name as string) ?? (r.consentByName as string) ?? null,
    consentRevokedAt: (r.consent_revoked_at as string) ?? (r.consentRevokedAt as string) ?? null,
    shareId: (r.share_id as string) ?? (r.shareId as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt ?? new Date().toISOString()),
    viewedAt: (r.viewed_at as string) ?? (r.viewedAt as string) ?? null,
    acceptedAt: (r.accepted_at as string) ?? (r.acceptedAt as string) ?? null,
    finishedAt: (r.finished_at as string) ?? (r.finishedAt as string) ?? null,
  };
}

function mapEvent(r: Record<string, unknown>): PatientNetworkReferralEvent {
  return {
    id: String(r.id),
    referralId: String(r.referral_id ?? r.referralId),
    action: String(r.action),
    actorKind: (r.actor_kind as string) ?? (r.actorKind as string) ?? null,
    actorId: (r.actor_id as string) ?? (r.actorId as string) ?? null,
    actorName: (r.actor_name as string) ?? (r.actorName as string) ?? null,
    detail: (r.detail as Record<string, unknown>) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}

function mapLink(r: Record<string, unknown>): PatientProfessionalLink {
  return {
    id: String(r.id),
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: (r.patient_name as string) ?? (r.patientName as string) ?? null,
    professionalKind: (r.professional_kind as ProfessionalKind) ?? (r.professionalKind as ProfessionalKind),
    professionalId: String(r.professional_id ?? r.professionalId),
    origin: ((r.origin as PatientProfessionalLink["origin"]) || "followup"),
    referralId: (r.referral_id as string) ?? (r.referralId as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}

function referralRow(r: PatientNetworkReferral): Record<string, unknown> {
  return {
    id: r.id,
    patient_key: r.patientKey,
    patient_name: r.patientName,
    registered_by_kind: r.registeredByKind,
    registered_by_id: r.registeredById,
    registered_by_name: r.registeredByName,
    from_kind: r.fromKind,
    from_id: r.fromId,
    from_name: r.fromName,
    from_profession: r.fromProfession,
    from_specialty: r.fromSpecialty,
    to_kind: r.toKind,
    to_id: r.toId,
    to_name: r.toName,
    to_profession: r.toProfession,
    to_specialty: r.toSpecialty,
    reason: r.reason,
    notes: r.notes,
    status: r.status,
    share_slices: r.shareSlices,
    consent_confirmed: r.consentConfirmed,
    consent_method: r.consentMethod,
    consent_at: r.consentAt,
    consent_by_kind: r.consentByKind,
    consent_by_id: r.consentById,
    consent_by_name: r.consentByName,
    consent_revoked_at: r.consentRevokedAt,
    share_id: r.shareId,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    viewed_at: r.viewedAt,
    accepted_at: r.acceptedAt,
    finished_at: r.finishedAt,
  };
}

export async function recordReferralEvent(input: {
  referralId: string;
  action: string;
  actorKind?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  const row: PatientNetworkReferralEvent = {
    id: uuid(),
    referralId: input.referralId,
    action: input.action,
    actorKind: input.actorKind ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    detail: input.detail ?? null,
    createdAt: new Date().toISOString(),
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("patient_network_referral_events").insert({
      id: row.id,
      referral_id: row.referralId,
      action: row.action,
      actor_kind: row.actorKind,
      actor_id: row.actorId,
      actor_name: row.actorName,
      detail: row.detail,
      created_at: row.createdAt,
    });
    if (!isMissing(error)) {
      if (error) console.error("[network] audit event", error);
      return;
    }
    tableMissing = true;
  }
  const db = await readLocal();
  db.events.push(row);
  await writeLocal(db);
}

export async function listReferralEvents(referralId: string): Promise<PatientNetworkReferralEvent[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("patient_network_referral_events")
      .select("*")
      .eq("referral_id", referralId)
      .order("created_at", { ascending: true });
    if (!isMissing(error) && !error) return (data ?? []).map((r) => mapEvent(r as Record<string, unknown>));
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.events.filter((e) => e.referralId === referralId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getNetworkReferral(id: string): Promise<PatientNetworkReferral | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_network_referrals").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapReferral(data as Record<string, unknown>) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.referrals.find((r) => r.id === id) ?? null;
}

export async function createNetworkReferral(
  input: Omit<PatientNetworkReferral, "id" | "createdAt" | "updatedAt" | "viewedAt" | "acceptedAt" | "finishedAt" | "consentRevokedAt" | "shareId"> & {
    shareId?: string | null;
  }
): Promise<PatientNetworkReferral> {
  const now = new Date().toISOString();
  const row: PatientNetworkReferral = {
    ...input,
    id: uuid(),
    patientKey: input.patientKey.toLowerCase().trim(),
    shareSlices: input.shareSlices.length ? input.shareSlices : [...DEFAULT_SHARE_SLICES],
    shareId: input.shareId ?? null,
    createdAt: now,
    updatedAt: now,
    viewedAt: null,
    acceptedAt: null,
    finishedAt: null,
    consentRevokedAt: null,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("patient_network_referrals").insert(referralRow(row));
    if (!isMissing(error)) {
      if (error) throw error;
      await recordReferralEvent({
        referralId: row.id,
        action: "created",
        actorKind: row.fromKind,
        actorId: row.fromId,
        actorName: row.fromName,
        detail: {
          to: row.toName,
          reason: row.reason,
          shareSlices: row.shareSlices,
          consentMethod: row.consentMethod,
          status: row.status,
        },
      });
      return row;
    }
    tableMissing = true;
  }
  const db = await readLocal();
  db.referrals.push(row);
  await writeLocal(db);
  await recordReferralEvent({
    referralId: row.id,
    action: "created",
    actorKind: row.fromKind,
    actorId: row.fromId,
    actorName: row.fromName,
    detail: { to: row.toName, reason: row.reason, shareSlices: row.shareSlices, consentMethod: row.consentMethod },
  });
  return row;
}

export async function updateNetworkReferral(
  id: string,
  patch: Partial<PatientNetworkReferral>,
  event?: { action: string; actorKind?: string | null; actorId?: string | null; actorName?: string | null; detail?: Record<string, unknown> | null }
): Promise<PatientNetworkReferral | null> {
  const current = await getNetworkReferral(id);
  if (!current) return null;
  const next: PatientNetworkReferral = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const row = referralRow(next);
    delete row.id;
    delete row.created_at;
    const { error } = await s.from("patient_network_referrals").update(row).eq("id", id);
    if (!isMissing(error)) {
      if (error) throw error;
      if (event) await recordReferralEvent({ referralId: id, ...event });
      return next;
    }
    tableMissing = true;
  }
  const db = await readLocal();
  db.referrals = db.referrals.map((r) => (r.id === id ? next : r));
  await writeLocal(db);
  if (event) await recordReferralEvent({ referralId: id, ...event });
  return next;
}

export async function listReferralsForProfessional(
  kind: ProfessionalKind,
  id: string
): Promise<{ incoming: PatientNetworkReferral[]; outgoing: PatientNetworkReferral[] }> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("patient_network_referrals")
      .select("*")
      .or(`and(to_kind.eq.${kind},to_id.eq.${id}),and(from_kind.eq.${kind},from_id.eq.${id})`)
      .order("created_at", { ascending: false });
    if (!isMissing(error) && !error) {
      const all = (data ?? []).map((r) => mapReferral(r as Record<string, unknown>));
      return {
        incoming: all.filter((r) => r.toKind === kind && r.toId === id && r.status !== "pending_consent"),
        outgoing: all.filter((r) => r.fromKind === kind && r.fromId === id),
      };
    }
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  const all = db.referrals
    .filter((r) => (r.toKind === kind && r.toId === id) || (r.fromKind === kind && r.fromId === id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    incoming: all.filter((r) => r.toKind === kind && r.toId === id && r.status !== "pending_consent"),
    outgoing: all.filter((r) => r.fromKind === kind && r.fromId === id),
  };
}

export async function listPendingConsentForPatient(patientKey: string): Promise<PatientNetworkReferral[]> {
  const key = patientKey.toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("patient_network_referrals")
      .select("*")
      .eq("patient_key", key)
      .order("created_at", { ascending: false });
    if (!isMissing(error) && !error) {
      return (data ?? []).map((r) => mapReferral(r as Record<string, unknown>));
    }
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.referrals.filter((r) => r.patientKey === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function upsertProfessionalLink(input: Omit<PatientProfessionalLink, "id" | "createdAt">): Promise<PatientProfessionalLink> {
  const key = input.patientKey.toLowerCase().trim();
  const existing = await findProfessionalLink(input.professionalKind, input.professionalId, key);
  if (existing) return existing;
  const row: PatientProfessionalLink = {
    ...input,
    id: uuid(),
    patientKey: key,
    createdAt: new Date().toISOString(),
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("patient_professional_links").insert({
      id: row.id,
      patient_key: row.patientKey,
      patient_name: row.patientName,
      professional_kind: row.professionalKind,
      professional_id: row.professionalId,
      origin: row.origin,
      referral_id: row.referralId,
      created_at: row.createdAt,
    });
    if (!isMissing(error)) {
      if (error) throw error;
      return row;
    }
    tableMissing = true;
  }
  const db = await readLocal();
  db.links.push(row);
  await writeLocal(db);
  return row;
}

export async function findProfessionalLink(
  kind: ProfessionalKind,
  professionalId: string,
  patientKey: string
): Promise<PatientProfessionalLink | null> {
  const key = patientKey.toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("patient_professional_links")
      .select("*")
      .eq("professional_kind", kind)
      .eq("professional_id", professionalId)
      .eq("patient_key", key)
      .maybeSingle();
    if (!isMissing(error) && !error) return data ? mapLink(data as Record<string, unknown>) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links.find((l) => l.professionalKind === kind && l.professionalId === professionalId && l.patientKey === key) ?? null;
}

export async function listLinksForProfessional(kind: ProfessionalKind, professionalId: string): Promise<PatientProfessionalLink[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("patient_professional_links")
      .select("*")
      .eq("professional_kind", kind)
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map((r) => mapLink(r as Record<string, unknown>));
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links
    .filter((l) => l.professionalKind === kind && l.professionalId === professionalId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function hasProfessionalPatientAccessAny(
  kind: ProfessionalKind,
  professionalId: string,
  keys: string[]
): Promise<boolean> {
  const unique = [...new Set(keys.map((k) => k.toLowerCase().trim()).filter(Boolean))];
  for (const key of unique) {
    if (await findProfessionalLink(kind, professionalId, key)) return true;
  }
  const lists = await listReferralsForProfessional(kind, professionalId);
  const set = new Set(unique);
  return [...lists.incoming, ...lists.outgoing].some(
    (r) =>
      set.has(r.patientKey.toLowerCase().trim()) &&
      ["accepted", "following", "viewed", "pending"].includes(r.status) &&
      r.consentConfirmed &&
      !r.consentRevokedAt
  );
}

export async function hasProfessionalPatientAccess(
  kind: ProfessionalKind,
  professionalId: string,
  patientKey: string
): Promise<boolean> {
  return hasProfessionalPatientAccessAny(kind, professionalId, [patientKey]);
}
