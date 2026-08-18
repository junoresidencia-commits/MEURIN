import "server-only";
import { getNutritionistId } from "./nutrition-session";
import {
  getNutritionist,
  listNutritionLinksForNutritionist,
  listReferralsForPatient,
  type Nutritionist,
} from "./nutritionists-store";
import { getPatient, clinicalKey } from "./patients-store";

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
 * Resolve o acesso da nutricionista a um paciente. Permitido quando o paciente
 * pertence a um médico vinculado OU quando há encaminhamento de um médico vinculado.
 */
export async function resolveNutritionPatientAccess(patientKey: string): Promise<NutritionPatientAccess | null> {
  const nut = await requireNutritionist();
  if (!nut) return null;
  const doctorIds = await linkedDoctorIds(nut.id);
  if (doctorIds.length === 0) return null;

  // Paciente cadastrado (pid:<id>) — resolve dono e dados básicos.
  let patient = null as Awaited<ReturnType<typeof getPatient>>;
  if (patientKey.startsWith("pid:")) patient = await getPatient(patientKey.slice(4));

  const refs = await listReferralsForPatient(patientKey);
  const refFromLinked = refs.find((r) => doctorIds.includes(r.doctorId)) || null;

  const ownerOk = patient ? doctorIds.includes(patient.doctorId) : false;
  if (!ownerOk && !refFromLinked) return null;

  const key = patient ? clinicalKey(patient) : patientKey;
  return {
    allowed: true,
    key,
    name: patient?.name || refFromLinked?.patientName || "Paciente",
    doctorId: patient?.doctorId || refFromLinked?.doctorId || doctorIds[0],
    birthdate: patient?.birthdate || null,
    sex: patient?.sex || null,
    cpf: patient?.cpf || null,
  };
}
