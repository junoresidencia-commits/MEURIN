import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "./supabase-admin";
import { readDb, updateDb } from "./store";
import { defaultAvailability } from "./scheduling";
import { createAttendant, findAttendantByCpfOrEmail, upsertLink } from "./attendants-store";
import { addMembership, listMemberships, writeAudit } from "./platform-store";
import type { ClinicInvite, InviteKind, InviteStatus } from "./platform-types";
import type { Doctor } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "clinic-ops.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = { invites: ClinicInvite[] };

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { invites: [] };
  }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapInvite(r: Record<string, unknown>): ClinicInvite {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    kind: String(r.kind) as InviteKind,
    email: String(r.email).toLowerCase(),
    name: String(r.name),
    crm: (r.crm as string) ?? null,
    specialty: (r.specialty as string) ?? null,
    token: String(r.token),
    status: String(r.status) as InviteStatus,
    invitedBy: (r.invited_by as string) ?? (r.invitedBy as string) ?? null,
    acceptedActorId: (r.accepted_actor_id as string) ?? (r.acceptedActorId as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    acceptedAt: (r.accepted_at as string) ?? (r.acceptedAt as string) ?? null,
  };
}

function newToken() {
  return randomBytes(24).toString("hex");
}

export async function listInvites(clinicId: string): Promise<ClinicInvite[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_invites").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapInvite(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).invites.filter((i) => i.clinicId === clinicId);
}

export async function getInviteByToken(token: string): Promise<ClinicInvite | null> {
  if (!token) return null;
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_invites").select("*").eq("token", token).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else {
      return data ? mapInvite(data as Record<string, unknown>) : null;
    }
  }
  return (await readLocal()).invites.find((i) => i.token === token) ?? null;
}

async function persistInvite(row: ClinicInvite): Promise<ClinicInvite> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_invites").insert({
      id: row.id,
      clinic_id: row.clinicId,
      kind: row.kind,
      email: row.email,
      name: row.name,
      crm: row.crm,
      specialty: row.specialty,
      token: row.token,
      status: row.status,
      invited_by: row.invitedBy,
      accepted_actor_id: row.acceptedActorId,
      created_at: row.createdAt,
      accepted_at: row.acceptedAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  local.invites.unshift(row);
  await writeLocal(local);
  return row;
}

async function markAccepted(id: string, actorId: string): Promise<void> {
  const now = new Date().toISOString();
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb
      .from("clinic_invites")
      .update({ status: "accepted", accepted_actor_id: actorId, accepted_at: now })
      .eq("id", id);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const row = local.invites.find((i) => i.id === id);
  if (row) {
    row.status = "accepted";
    row.acceptedActorId = actorId;
    row.acceptedAt = now;
    await writeLocal(local);
  }
}

export type InviteResult = {
  invite: ClinicInvite;
  linkedExisting: boolean;
  actorId: string | null;
};

/** Convida médico. Se já existe, só cria membership no mesmo ID. Gestora nunca define senha. */
export async function inviteDoctor(input: {
  clinicId: string;
  name: string;
  email: string;
  crm?: string;
  specialty?: string;
  invitedBy: string;
}): Promise<InviteResult> {
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  if (!email || !name) throw new Error("Nome e e-mail são obrigatórios.");
  const db = await readDb();
  const existing = db.doctors.find((d) => d.email.toLowerCase() === email);
  const now = new Date().toISOString();
  const invite: ClinicInvite = {
    id: uuid(),
    clinicId: input.clinicId,
    kind: "doctor",
    email,
    name,
    crm: input.crm?.trim() || null,
    specialty: input.specialty?.trim() || null,
    token: newToken(),
    status: existing ? "accepted" : "pending",
    invitedBy: input.invitedBy,
    acceptedActorId: existing?.id ?? null,
    createdAt: now,
    acceptedAt: existing ? now : null,
  };
  await persistInvite(invite);
  if (existing) {
    await addMembership({ clinicId: input.clinicId, actorKind: "doctor", actorId: existing.id, role: "MEDICO" });
    await writeAudit({
      actorKind: "doctor",
      actorId: input.invitedBy,
      actorEmail: email,
      action: "clinic_link_existing_doctor",
      entity: "clinic_membership",
      entityId: input.clinicId,
      detail: `Médico já existente ${existing.id} vinculado. Sem novo usuário.`,
    });
    return { invite, linkedExisting: true, actorId: existing.id };
  }
  await writeAudit({
    actorKind: "doctor",
    actorId: input.invitedBy,
    actorEmail: email,
    action: "clinic_invite_doctor",
    entity: "clinic_invite",
    entityId: invite.id,
    detail: "Convite pendente. A gestora não definiu senha.",
  });
  return { invite, linkedExisting: false, actorId: null };
}

/** Convida atendente. Se já existe, só vincula à clínica e aos médicos dela. */
export async function inviteAttendant(input: {
  clinicId: string;
  name: string;
  email: string;
  invitedBy: string;
}): Promise<InviteResult> {
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  if (!email || !name) throw new Error("Nome e e-mail são obrigatórios.");
  const existing = await findAttendantByCpfOrEmail(null, email);
  const now = new Date().toISOString();
  const invite: ClinicInvite = {
    id: uuid(),
    clinicId: input.clinicId,
    kind: "attendant",
    email,
    name,
    crm: null,
    specialty: null,
    token: newToken(),
    status: existing ? "accepted" : "pending",
    invitedBy: input.invitedBy,
    acceptedActorId: existing?.id ?? null,
    createdAt: now,
    acceptedAt: existing ? now : null,
  };
  await persistInvite(invite);
  if (existing) {
    await linkAttendantToClinic(input.clinicId, existing.id);
    await writeAudit({
      actorKind: "doctor",
      actorId: input.invitedBy,
      actorEmail: email,
      action: "clinic_link_existing_attendant",
      entity: "clinic_membership",
      entityId: input.clinicId,
      detail: `Atendente já existente ${existing.id} vinculada. Sem nova senha.`,
    });
    return { invite, linkedExisting: true, actorId: existing.id };
  }
  await writeAudit({
    actorKind: "doctor",
    actorId: input.invitedBy,
    actorEmail: email,
    action: "clinic_invite_attendant",
    entity: "clinic_invite",
    entityId: invite.id,
    detail: "Convite pendente. A gestora não definiu senha.",
  });
  return { invite, linkedExisting: false, actorId: null };
}

export async function linkAttendantToClinic(clinicId: string, attendantId: string): Promise<void> {
  await addMembership({ clinicId, actorKind: "attendant", actorId: attendantId, role: "ATENDENTE" });
  const doctors = (await listMemberships(clinicId)).filter(
    (m) => m.actorKind === "doctor" && m.status === "active" && (m.role === "MEDICO" || m.role === "ADMIN_CLINICA")
  );
  const seen = new Set<string>();
  for (const m of doctors) {
    if (seen.has(m.actorId)) continue;
    seen.add(m.actorId);
    await upsertLink(attendantId, m.actorId);
  }
}

export async function acceptInvite(token: string, password: string): Promise<{ actorKind: InviteKind; actorId: string }> {
  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== "pending") throw new Error("Convite inválido ou já usado.");
  if (!password || password.length < 6) throw new Error("Defina uma senha com pelo menos 6 caracteres.");

  if (invite.kind === "doctor") {
    const db = await readDb();
    const already = db.doctors.find((d) => d.email.toLowerCase() === invite.email);
    if (already) {
      await addMembership({ clinicId: invite.clinicId, actorKind: "doctor", actorId: already.id, role: "MEDICO" });
      await markAccepted(invite.id, already.id);
      return { actorKind: "doctor", actorId: already.id };
    }
    const doctor: Doctor = {
      id: uuid(),
      name: invite.name,
      email: invite.email,
      passwordHash: await bcrypt.hash(password, 10),
      crm: invite.crm || "A informar",
      specialty: invite.specialty || "Nefrologia",
      bio: "",
      consultationPriceCents: 35000,
      stripeConnectReady: false,
      weeklyAvailability: defaultAvailability(),
      blockedSlots: [],
      createdAt: new Date().toISOString(),
      status: "approved",
    };
    await updateDb((current) => ({ ...current, doctors: [...current.doctors, doctor] }));
    await addMembership({ clinicId: invite.clinicId, actorKind: "doctor", actorId: doctor.id, role: "MEDICO" });
    await markAccepted(invite.id, doctor.id);
    await writeAudit({
      actorKind: "doctor",
      actorId: doctor.id,
      actorEmail: invite.email,
      action: "clinic_invite_accepted",
      entity: "doctor",
      entityId: doctor.id,
      detail: "Médico criou a própria senha a partir do convite.",
    });
    return { actorKind: "doctor", actorId: doctor.id };
  }

  const existing = await findAttendantByCpfOrEmail(null, invite.email);
  if (existing) {
    await linkAttendantToClinic(invite.clinicId, existing.id);
    await markAccepted(invite.id, existing.id);
    return { actorKind: "attendant", actorId: existing.id };
  }
  const att = await createAttendant({ name: invite.name, email: invite.email, password });
  await linkAttendantToClinic(invite.clinicId, att.id);
  await markAccepted(invite.id, att.id);
  await writeAudit({
    actorKind: "attendant",
    actorId: att.id,
    actorEmail: invite.email,
    action: "clinic_invite_accepted",
    entity: "attendant",
    entityId: att.id,
    detail: "Atendente criou a própria senha a partir do convite.",
  });
  return { actorKind: "attendant", actorId: att.id };
}
