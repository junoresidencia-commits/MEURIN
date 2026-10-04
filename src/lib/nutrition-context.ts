import "server-only";
import { getNutritionistId } from "./nutrition-session";
import {
  getNutritionist,
  listNutritionLinksForNutritionist,
  listReferralsForPatient,
  type Nutritionist,
} from "./nutritionists-store";
import { clinicalKey, findPatientByClinicalKey } from "./patients-store";
import { patientKeyCandidates, patientKeysMatch } from "./patient-keys";
import { hasProfessionalPatientAccessAny, listLinksForProfessional } from "./network-referrals-store";

export interface NutritionPatientAccess {
  allowed: boolean;
  key: string; // chave clínica (email ou pid:<id>) usada em notas/labs/perfil
  name: string;
  doctorId: string;
  birthdate: string | null;
  sex: string | null;
  cpf: string | null;
}

/** Nutricionista logada e ativa. */
export async function requireNutritionist(): Promise<Nutritionist | null> {
  const id = await getNutritionistId();
  if (!id) return null;
  const nut = await getNutritionist(id);
  if (!nut || nut.status !== "active") return null;
  return nut;
}

/** IDs dos médicos aos quais a nutricionista está vinculada (ativos). */
export async function linkedDoctorIds(nutritionistId: string): Promise<string[]> {
  const links = await listNutritionLinksForNutritionist(nutritionistId);
  return links.map((l) => l.doctorId);
}

/**
 * Acesso a pacientes encaminhados (legado) ou vinculados na rede.
 * Histórico de consulta não reabre acesso depois que o encaminhamento é encerrado.
 */
export async function resolveNutritionPatientAccess(patientKey: string): Promise<NutritionPatientAccess | null> {
  const nut = await requireNutritionist();
  if (!nut) return null;
  const doctorIds = await linkedDoctorIds(nut.id);
  const patient = await findPatientByClinicalKey(patientKey);
  const keys = patientKeyCandidates(patientKey, patient);

  let refFromLinked = null as Awaited<ReturnType<typeof listReferralsForPatient>>[number] | null;
  if (doctorIds.length > 0) {
    const seen = new Set<string>();
    for (const k of keys) {
      const refs = await listReferralsForPatient(k);
      for (const r of refs) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        if (
          r.status !== "encerrado" &&
          doctorIds.includes(r.doctorId) &&
          (r.nutritionistId === nut.id || !r.nutritionistId) &&
          patientKeysMatch(keys, r.patientKey)
        ) {
          refFromLinked = r;
          break;
        }
      }
      if (refFromLinked) break;
    }
  }

  const networkOk = await hasProfessionalPatientAccessAny("nutrition", nut.id, keys);
  if (!refFromLinked && !networkOk) return null;

  const linkName = networkOk
    ? (await listLinksForProfessional("nutrition", nut.id)).find((l) => patientKeysMatch(keys, l.patientKey))?.patientName
    : null;

  const key = patient ? clinicalKey(patient) : (refFromLinked?.patientKey || keys[0] || patientKey);
  return {
    allowed: true,
    key,
    name: patient?.name || refFromLinked?.patientName || linkName || "Paciente",
    doctorId: patient?.doctorId || refFromLinked?.doctorId || doctorIds[0] || "",
    birthdate: patient?.birthdate || null,
    sex: patient?.sex || null,
    cpf: patient?.cpf || null,
  };
}
