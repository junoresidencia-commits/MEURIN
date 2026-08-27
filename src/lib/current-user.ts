import "server-only";
import { getDoctorSessionId } from "./auth";
import { getPatientEmail } from "./patient-session";
import { getNutritionistId } from "./nutrition-session";
import { getAlliedSessionId } from "./allied-session";
import { getAlliedProfessional } from "./allied-store";
import type { NotifyRole } from "./types";

export interface CurrentUser {
  userId: string;
  role: NotifyRole;
}

/** Identifica o usuário logado (médico tem prioridade), para APIs compartilhadas
 *  (push, central de notificações). Retorna null quando ninguém está logado. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const doctorId = await getDoctorSessionId();
  if (doctorId) return { userId: doctorId, role: "medico" };
  const nutritionistId = await getNutritionistId();
  if (nutritionistId) return { userId: nutritionistId, role: "nutricionista" };
  const alliedId = await getAlliedSessionId();
  if (alliedId) {
    const pro = await getAlliedProfessional(alliedId);
    if (pro?.role === "psychology") return { userId: alliedId, role: "psicologo" };
    if (pro?.role === "nursing") return { userId: alliedId, role: "enfermeiro" };
  }
  const patient = await getPatientEmail();
  if (patient) return { userId: patient.toLowerCase().trim(), role: "paciente" };
  return null;
}
