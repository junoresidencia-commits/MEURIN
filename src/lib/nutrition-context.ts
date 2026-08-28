import "server-only";
import { getNutritionistId } from "./nutrition-session";
import {
  getNutritionist,
  listNutritionLinksForNutritionist,
  listReferralsForPatient,
  type Nutritionist,
} from "./nutritionists-store";
import { getPatient, clinicalKey, findByEmailAny } from "./patients-store";

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

function candidateKeys(patientKey: string, patient: Awaited<ReturnType<typeof getPatient>>): string[] {
  const keys = new Set<string>([patientKey]);
  if (patient) {
    keys.add(clinicalKey(patient));
    if (patient.email) keys.add(patient.email.toLowerCase());
    keys.add(`pid:${patient.id}`);
  }
  return [...keys];
}

/**
 * Acesso somente a pacientes encaminhados a esta nutricionista (ou encaminhamento
 * legado sem nutricionista específica, de médico vinculado). Histórico de consulta
 * não reabre acesso depois que o encaminhamento é encerrado.
 */
export async function resolveNutritionPatientAccess(patientKey: string): Promise<NutritionPatientAccess | null> {
  const nut = await requireNutritionist();
  if (!nut) return null;
  const doctorIds = await linkedDoctorIds(nut.id);
  if (doctorIds.length === 0) return null;

  let patient = null as Awaited<ReturnType<typeof getPatient>>;
  if (patientKey.startsWith("pid:")) patient = await getPatient(patientKey.slice(4));
  else if (patientKey.includes("@")) patient = await findByEmailAny(patientKey);
  else patient = await getPatient(patientKey);

  const keys = candidateKeys(patientKey, patient);
  let refFromLinked = null as Awaited<ReturnType<typeof listReferralsForPatient>>[number] | null;
  for (const k of keys) {
    const refs = await listReferralsForPatient(k);
    refFromLinked = refs.find((r) =>
      doctorIds.includes(r.doctorId)
      && r.status !== "encerrado"
      && (r.nutritionistId === nut.id || !r.nutritionistId)
    ) || null;
    if (refFromLinked) break;
  }

  if (!refFromLinked) return null;

  const key = patient ? clinicalKey(patient) : (refFromLinked.patientKey || patientKey);
  return {
    allowed: true,
    key,
    name: patient?.name || refFromLinked.patientName || "Paciente",
    doctorId: patient?.doctorId || refFromLinked.doctorId || doctorIds[0],
    birthdate: patient?.birthdate || null,
    sex: patient?.sex || null,
    cpf: patient?.cpf || null,
  };
}
