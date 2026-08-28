import "server-only";
import { getAlliedSessionId } from "./allied-session";
import {
  getAlliedProfessional,
  listActiveDoctorIdsForProfessional,
  listReferralsForProfessional,
  type AlliedProfessional,
  type AlliedRole,
} from "./allied-store";
import { getPatient, clinicalKey } from "./patients-store";

export async function requireAllied(role?: AlliedRole): Promise<AlliedProfessional | null> {
  const id = await getAlliedSessionId();
  if (!id) return null;
  const pro = await getAlliedProfessional(id);
  if (!pro || pro.status !== "active") return null;
  if (role && pro.role !== role) return null;
  return pro;
}

export async function resolveAlliedPatientAccess(patientKey: string, pro?: AlliedProfessional | null) {
  const professional = pro || await requireAllied();
  if (!professional) return null;
  const refs = await listReferralsForProfessional(professional.id);
  const doctorIds = await listActiveDoctorIdsForProfessional(professional.id);
  const keys = new Set<string>([patientKey]);
  try { keys.add(decodeURIComponent(patientKey)); } catch { /* ignore */ }
  if (patientKey.startsWith("pid:")) keys.add(patientKey.slice(4));
  else keys.add(`pid:${patientKey}`);
  const ref = refs.find((r) => keys.has(r.patientKey) && r.status !== "encerrado" && doctorIds.includes(r.doctorId));
  if (!ref) return null;

  let patient = null as Awaited<ReturnType<typeof getPatient>>;
  const id = patientKey.startsWith("pid:") ? patientKey.slice(4) : patientKey;
  if (id && !id.includes("@")) patient = await getPatient(id);
  return {
    allowed: true as const,
    key: patient ? clinicalKey(patient) : patientKey,
    name: patient?.name || ref.patientName || "Paciente",
    doctorId: patient?.doctorId || ref.doctorId || doctorIds[0] || "",
    birthdate: patient?.birthdate || null,
    sex: patient?.sex || null,
    cpf: patient?.cpf || null,
    professional,
  };
}
