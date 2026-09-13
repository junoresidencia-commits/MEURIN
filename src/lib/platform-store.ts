import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { readDb } from "./store";
import {
  FOUNDER_SUPER_ADMIN_EMAIL,
  type ActorKind,
  type Clinic,
  type ClinicMembership,
  type ClinicStatus,
  type PlatformAuditEntry,
  type PlatformRole,
  type PlatformRoleAssignment,
} from "./platform-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "platform.json");
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
  roles: PlatformRoleAssignment[];
  clinics: Clinic[];
  memberships: ClinicMembership[];
  audit: PlatformAuditEntry[];
};

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { roles: [], clinics: [], memberships: [], audit: [] };
  }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapRole(r: Record<string, unknown>): PlatformRoleAssignment {
  return {
    id: String(r.id),
    actorKind: String(r.actor_kind ?? r.actorKind) as ActorKind,
    actorId: String(r.actor_id ?? r.actorId),
    role: String(r.role) as PlatformRole,
    grantedBy: (r.granted_by as string) ?? (r.grantedBy as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    revokedAt: (r.revoked_at as string) ?? (r.revokedAt as string) ?? null,
  };
}
function mapClinic(r: Record<string, unknown>): Clinic {
  return {
    id: String(r.id),
    name: String(r.name),
    legalName: (r.legal_name as string) ?? (r.legalName as string) ?? null,
    cnpj: (r.cnpj as string) ?? null,
    city: (r.city as string) ?? null,
    status: ((r.status as ClinicStatus) || "active"),
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}
function mapMembership(r: Record<string, unknown>): ClinicMembership {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    actorKind: String(r.actor_kind ?? r.actorKind) as ActorKind,
    actorId: String(r.actor_id ?? r.actorId),
    role: String(r.role) as PlatformRole,
    status: (r.status as ClinicMembership["status"]) || "active",
    permissions: (r.permissions as Record<string, boolean>) || {},
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}

/** Garante SUPER_ADMIN no médico já existente com o e-mail fundador. Nunca cria conta nova. */
export async function ensureFounderSuperAdmin(): Promise<{ granted: boolean; doctorId: string | null }> {
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.email.toLowerCase() === FOUNDER_SUPER_ADMIN_EMAIL);
  if (!doctor) return { granted: false, doctorId: null };
  const roles = await listActiveRoles("doctor", doctor.id);
  if (roles.includes("SUPER_ADMIN")) return { granted: false, doctorId: doctor.id };
  await grantRole("doctor", doctor.id, "SUPER_ADMIN", "system:founder-bootstrap");
  await writeAudit({
    actorKind: "system",
    actorId: null,
    actorEmail: FOUNDER_SUPER_ADMIN_EMAIL,
    action: "grant_super_admin",
    entity: "doctor",
    entityId: doctor.id,
    detail: "Papel SUPER_ADMIN no usuário médico já existente. ID preservado.",
  });
  return { granted: true, doctorId: doctor.id };
}

export async function listActiveRoles(actorKind: ActorKind, actorId: string): Promise<PlatformRole[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("platform_role_assignments")
      .select("*")
      .eq("actor_kind", actorKind)
      .eq("actor_id", actorId)
      .is("revoked_at", null);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapRole(r as Record<string, unknown>).role);
    }
  }
  const local = await readLocal();
  return local.roles
    .filter((r) => r.actorKind === actorKind && r.actorId === actorId && !r.revokedAt)
    .map((r) => r.role);
}

export async function grantRole(
  actorKind: ActorKind,
  actorId: string,
  role: PlatformRole,
  grantedBy: string | null
): Promise<PlatformRoleAssignment> {
  const row: PlatformRoleAssignment = {
    id: uuid(),
    actorKind,
    actorId,
    role,
    grantedBy,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("platform_role_assignments").insert({
      id: row.id,
      actor_kind: actorKind,
      actor_id: actorId,
      role,
      granted_by: grantedBy,
      created_at: row.createdAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  if (!local.roles.some((r) => r.actorKind === actorKind && r.actorId === actorId && r.role === role && !r.revokedAt)) {
    local.roles.push(row);
    await writeLocal(local);
  }
  return row;
}

export async function listClinics(): Promise<Clinic[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinics").select("*").order("name");
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapClinic(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).clinics;
}

export async function createClinic(input: {
  name: string;
  legalName?: string;
  cnpj?: string;
  city?: string;
}): Promise<Clinic> {
  const now = new Date().toISOString();
  const clinic: Clinic = {
    id: uuid(),
    name: input.name.trim(),
    legalName: input.legalName?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
    city: input.city?.trim() || null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinics").insert({
      id: clinic.id,
      name: clinic.name,
      legal_name: clinic.legalName,
      cnpj: clinic.cnpj,
      city: clinic.city,
      status: clinic.status,
      created_at: now,
      updated_at: now,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return clinic;
  }
  const local = await readLocal();
  local.clinics.push(clinic);
  await writeLocal(local);
  return clinic;
}

export async function listMemberships(clinicId?: string): Promise<ClinicMembership[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    let q = sb.from("clinic_memberships").select("*");
    if (clinicId) q = q.eq("clinic_id", clinicId);
    const { data, error } = await q;
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapMembership(r as Record<string, unknown>));
    }
  }
  const local = await readLocal();
  return clinicId ? local.memberships.filter((m) => m.clinicId === clinicId) : local.memberships;
}

export async function addMembership(input: {
  clinicId: string;
  actorKind: ActorKind;
  actorId: string;
  role: PlatformRole;
}): Promise<ClinicMembership> {
  const now = new Date().toISOString();
  const row: ClinicMembership = {
    id: uuid(),
    clinicId: input.clinicId,
    actorKind: input.actorKind,
    actorId: input.actorId,
    role: input.role,
    status: "active",
    permissions: {},
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_memberships").insert({
      id: row.id,
      clinic_id: row.clinicId,
      actor_kind: row.actorKind,
      actor_id: row.actorId,
      role: row.role,
      status: row.status,
      permissions: row.permissions,
      created_at: now,
      updated_at: now,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  local.memberships.push(row);
  await writeLocal(local);
  return row;
}

export async function writeAudit(input: Omit<PlatformAuditEntry, "id" | "createdAt">): Promise<void> {
  const row: PlatformAuditEntry = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("platform_audit_log").insert({
      id: row.id,
      actor_kind: row.actorKind,
      actor_id: row.actorId,
      actor_email: row.actorEmail,
      action: row.action,
      entity: row.entity,
      entity_id: row.entityId,
      detail: row.detail,
      created_at: row.createdAt,
    });
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  local.audit.unshift(row);
  local.audit = local.audit.slice(0, 500);
  await writeLocal(local);
}

export async function listAudit(limit = 40): Promise<PlatformAuditEntry[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("platform_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => ({
        id: String((r as { id: string }).id),
        actorKind: (r as { actor_kind?: string }).actor_kind ?? null,
        actorId: (r as { actor_id?: string }).actor_id ?? null,
        actorEmail: (r as { actor_email?: string }).actor_email ?? null,
        action: String((r as { action: string }).action),
        entity: (r as { entity?: string }).entity ?? null,
        entityId: (r as { entity_id?: string }).entity_id ?? null,
        detail: (r as { detail?: string }).detail ?? null,
        createdAt: String((r as { created_at: string }).created_at),
      }));
    }
  }
  return (await readLocal()).audit.slice(0, limit);
}

export async function countPlatformRows(): Promise<{ clinics: number; memberships: number; roleAssignments: number }> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const [c, m, r] = await Promise.all([
      sb.from("clinics").select("id", { count: "exact", head: true }),
      sb.from("clinic_memberships").select("id", { count: "exact", head: true }),
      sb.from("platform_role_assignments").select("id", { count: "exact", head: true }).is("revoked_at", null),
    ]);
    if (isMissing(c.error) || isMissing(m.error) || isMissing(r.error)) tableMissing = true;
    else {
      return {
        clinics: c.count ?? 0,
        memberships: m.count ?? 0,
        roleAssignments: r.count ?? 0,
      };
    }
  }
  const local = await readLocal();
  return {
    clinics: local.clinics.length,
    memberships: local.memberships.filter((x) => x.status === "active").length,
    roleAssignments: local.roles.filter((x) => !x.revokedAt).length,
  };
}
