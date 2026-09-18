import "server-only";
import { getDoctorSessionId } from "./auth";
import { getAttendantId } from "./attendant-session";
import { getAttendant } from "./attendants-store";
import { getDoctorById } from "./store";
import { ensureFounderSuperAdmin, getClinic, getClinicsByIds, listActiveRoles, listMemberships, listMembershipsForActor } from "./platform-store";
import type { Clinic, ClinicCashPermKey, ClinicMembership, ClinicStockPermKey, PlatformRole } from "./platform-types";

export type ClinicSummary = {
  clinicId: string;
  clinicName: string;
  role: PlatformRole;
};

export type PlatformActor = {
  doctorId: string;
  email: string;
  name: string;
  roles: PlatformRole[];
  isSuperAdmin: boolean;
  clinicAdmin: ClinicSummary[];
};

export async function buildPlatformActor(doctor: {
  id: string;
  email: string;
  name: string;
}): Promise<PlatformActor> {
  try {
    await ensureFounderSuperAdmin();
  } catch (err) {
    console.error("[platform-access] bootstrap ignorado", err);
  }
  let roles: PlatformRole[] = [];
  let memberships: ClinicMembership[] = [];
  try {
    [roles, memberships] = await Promise.all([
      listActiveRoles("doctor", doctor.id),
      listMembershipsForActor("doctor", doctor.id),
    ]);
  } catch (err) {
    console.error("[platform-access] papéis/clínicas ignorados", err);
  }
  const adminMs = memberships.filter((x) => x.role === "ADMIN_CLINICA");
  let clinicAdmin: ClinicSummary[] = [];
  try {
    const clinics = await getClinicsByIds(adminMs.map((m) => m.clinicId));
    const byId = new Map(clinics.map((c) => [c.id, c]));
    clinicAdmin = adminMs.flatMap((m) => {
      const clinic = byId.get(m.clinicId);
      if (!clinic || clinic.status === "suspended" || clinic.status === "draft") return [];
      return [{ clinicId: clinic.id, clinicName: clinic.name, role: m.role }];
    });
  } catch (err) {
    console.error("[platform-access] clínicas ignoradas", err);
  }
  return {
    doctorId: doctor.id,
    email: doctor.email,
    name: doctor.name,
    roles,
    isSuperAdmin: roles.includes("SUPER_ADMIN"),
    clinicAdmin,
  };
}

export async function getPlatformActor(): Promise<PlatformActor | null> {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return null;
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return null;
  return buildPlatformActor(doctor);
}

export async function requireSuperAdmin(): Promise<PlatformActor | null> {
  const actor = await getPlatformActor();
  if (!actor?.isSuperAdmin) return null;
  return actor;
}

export type ClinicStaff = {
  kind: "doctor" | "attendant";
  actorId: string;
  email: string | null;
  name: string;
  clinic: Clinic;
  membership: ClinicMembership | null;
  isSuperAdmin: boolean;
  canAdmin: boolean;
  canCheckout: boolean;
};

const ATTENDANT_CASH_DEFAULT: Record<ClinicCashPermKey, boolean> = {
  expense: true,
  close_cash: true,
  receipt: true,
  nfse_request: true,
  finance_view: true,
};

export function clinicCashPerm(staff: ClinicStaff, key: ClinicCashPermKey): boolean {
  if (staff.canAdmin) return true;
  const explicit = staff.membership?.permissions?.[key];
  if (explicit === false) return false;
  if (explicit === true) return true;
  if (staff.kind === "attendant") return ATTENDANT_CASH_DEFAULT[key];
  return false;
}

export function clinicCashPerms(staff: ClinicStaff): Record<ClinicCashPermKey, boolean> {
  return {
    expense: clinicCashPerm(staff, "expense"),
    close_cash: clinicCashPerm(staff, "close_cash"),
    receipt: clinicCashPerm(staff, "receipt"),
    nfse_request: clinicCashPerm(staff, "nfse_request"),
    finance_view: clinicCashPerm(staff, "finance_view"),
  };
}

const ATTENDANT_STOCK_DEFAULT: Record<ClinicStockPermKey, boolean> = {
  stock_view: true,
  stock_out: true,
  stock_in: true,
  stock_request: true,
  stock_manage: false,
};

export function clinicStockPerm(staff: ClinicStaff, key: ClinicStockPermKey): boolean {
  if (staff.canAdmin) return true;
  const explicit = staff.membership?.permissions?.[key];
  if (explicit === false) return false;
  if (explicit === true) return true;
  if (staff.kind === "attendant") return ATTENDANT_STOCK_DEFAULT[key];
  return false;
}

export function clinicStockPerms(staff: ClinicStaff): Record<ClinicStockPermKey, boolean> {
  return {
    stock_view: clinicStockPerm(staff, "stock_view"),
    stock_out: clinicStockPerm(staff, "stock_out"),
    stock_in: clinicStockPerm(staff, "stock_in"),
    stock_request: clinicStockPerm(staff, "stock_request"),
    stock_manage: clinicStockPerm(staff, "stock_manage"),
  };
}

export async function getClinicStaff(clinicId: string): Promise<ClinicStaff | null> {
  const clinic = await getClinic(clinicId);
  if (!clinic) return null;
  const blocked = clinic.status === "suspended" || clinic.status === "draft";

  const doctor = await getPlatformActor();
  if (doctor) {
    if (blocked && !doctor.isSuperAdmin) return null;
    const memberships = await listMemberships(clinicId);
    const membership =
      memberships.find((m) => m.actorKind === "doctor" && m.actorId === doctor.doctorId && m.status === "active") ?? null;
    const canAdmin = doctor.isSuperAdmin || membership?.role === "ADMIN_CLINICA";
    const canCheckout = Boolean(canAdmin) && !blocked;
    if (!canAdmin) return null;
    return {
      kind: "doctor",
      actorId: doctor.doctorId,
      email: doctor.email,
      name: doctor.name,
      clinic,
      membership,
      isSuperAdmin: doctor.isSuperAdmin,
      canAdmin,
      canCheckout: canAdmin || canCheckout,
    };
  }

  const attendantId = await getAttendantId();
  if (!attendantId) return null;
  if (blocked) return null;
  const att = await getAttendant(attendantId);
  if (!att || att.status !== "active") return null;
  const memberships = await listMemberships(clinicId);
  const membership = memberships.find((m) => m.actorKind === "attendant" && m.actorId === att.id && m.status === "active") ?? null;
  if (!membership) return null;
  return {
    kind: "attendant",
    actorId: att.id,
    email: att.email ?? null,
    name: att.name,
    clinic,
    membership,
    isSuperAdmin: false,
    canAdmin: false,
    canCheckout: true,
  };
}

export async function requireClinicAdmin(clinicId: string): Promise<ClinicStaff | null> {
  const staff = await getClinicStaff(clinicId);
  if (!staff?.canAdmin) return null;
  return staff;
}

export async function requireClinicCheckout(clinicId: string): Promise<ClinicStaff | null> {
  const staff = await getClinicStaff(clinicId);
  if (!staff?.canCheckout) return null;
  return staff;
}

export async function requireClinicCashPerm(
  clinicId: string,
  key: ClinicCashPermKey
): Promise<ClinicStaff | null> {
  const staff = await getClinicStaff(clinicId);
  if (!staff) return null;
  if (!clinicCashPerm(staff, key)) return null;
  return staff;
}

export async function requireClinicStockPerm(
  clinicId: string,
  key: ClinicStockPermKey
): Promise<ClinicStaff | null> {
  const staff = await getClinicStaff(clinicId);
  if (!staff) return null;
  if (!clinicStockPerm(staff, key)) return null;
  return staff;
}
