import "server-only";
import { getAlliedSessionId } from "./allied-session";
import {
  getAlliedProfessional,
  listActiveDoctorIdsForProfessional,
  listReferralsForProfessional,
  type AlliedProfessional,
  type AlliedRole,
} from "./allied-store";
import { clinicalKey, findPatientByClinicalKey } from "./patients-store";
import { patientKeyCandidates, patientKeysMatch } from "./patient-keys";
import { hasProfessionalPatientAccessAny, listLinksForProfessional } from "./network-referrals-store";

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

  const patient = await findPatientByClinicalKey(patientKey);
  const keys = patientKeyCandidates(patientKey, patient);
  const refs = await listReferralsForProfessional(professional.id);
  const doctorIds = await listActiveDoctorIdsForProfessional(professional.id);
  const ref = refs.find(
    (r) => r.status !== "encerrado" && patientKeysMatch(keys, r.patientKey) && (!doctorIds.length || doctorIds.includes(r.doctorId))
  );
  const networkOk = await hasProfessionalPatientAccessAny(professional.role, professional.id, keys);
  if (!ref && !networkOk) return null;

  const linkName = networkOk
    ? (await listLinksForProfessional(professional.role, professional.id)).find((l) => patientKeysMatch(keys, l.patientKey))?.patientName
    : null;

  return {
    allowed: true as const,
    key: patient ? clinicalKey(patient) : (ref?.patientKey || keys[0] || patientKey),
    name: patient?.name || ref?.patientName || linkName || "Paciente",
    doctorId: patient?.doctorId || ref?.doctorId || doctorIds[0] || "",
    birthdate: patient?.birthdate || null,
    sex: patient?.sex || null,
    cpf: patient?.cpf || null,
    professional,
  };
}
