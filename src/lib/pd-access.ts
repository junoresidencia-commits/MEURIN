import "server-only";
import { getDoctorSessionId } from "./auth";
import { getDoctorById } from "./store";
import { resolvePatientAccess } from "./doctor-access";
import { requireAllied } from "./allied-access";
import { getProfile } from "./clinical-profile-store";

export async function resolvePdWriteAccess(patientParam: string) {
  const decoded = decodeURIComponent(patientParam);
  const doctorId = await getDoctorSessionId();
  if (doctorId) {
    const access = await resolvePatientAccess(decoded);
    if (!access?.allowed) return null;
    const doctor = await getDoctorById(doctorId);
    return {
      key: access.key,
      actorId: doctorId,
      actorName: doctor?.name || "Médico",
      actorRole: "doctor" as const,
    };
  }
  const allied = await requireAllied("nursing");
  if (!allied) return null;
  const { resolveAlliedPatientAccess } = await import("./allied-access");
  const access = await resolveAlliedPatientAccess(decoded, allied);
  if (!access) return null;
  return {
    key: access.key,
    actorId: allied.id,
    actorName: allied.name,
    actorRole: "nursing" as const,
  };
}

export async function isPdClinicalPatient(patientKey: string): Promise<boolean> {
  const profile = await getProfile(patientKey);
  const v = profile?.data?.dialise_peritoneal;
  return v === true || v === "sim";
}
