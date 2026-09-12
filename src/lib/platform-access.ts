import "server-only";
import { getDoctorSessionId } from "./auth";
import { readDb } from "./store";
import { ensureFounderSuperAdmin, listActiveRoles } from "./platform-store";
import type { PlatformRole } from "./platform-types";

export type PlatformActor = {
  doctorId: string;
  email: string;
  name: string;
  roles: PlatformRole[];
  isSuperAdmin: boolean;
};

export async function getPlatformActor(): Promise<PlatformActor | null> {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return null;
  await ensureFounderSuperAdmin();
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return null;
  const roles = await listActiveRoles("doctor", doctor.id);
  return {
    doctorId: doctor.id,
    email: doctor.email,
    name: doctor.name,
    roles,
    isSuperAdmin: roles.includes("SUPER_ADMIN"),
  };
}

export async function requireSuperAdmin(): Promise<PlatformActor | null> {
  const actor = await getPlatformActor();
  if (!actor?.isSuperAdmin) return null;
  return actor;
}
