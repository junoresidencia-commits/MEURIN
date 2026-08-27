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
  const ref = refs.find((r) => r.patientKey === patientKey && r.status !== "encerrado" && doctorIds.includes(r.doctorId));
  if (!ref) return null;

  let patient = null as Awaited<ReturnType<typeof getPatient>>;
  if (patientKey.startsWith("pid:")) patient = await getPatient(patientKey.slice(4));
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
