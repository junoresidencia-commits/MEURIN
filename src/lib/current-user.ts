import "server-only";
import { getDoctorSessionId } from "./auth";
import { getPatientEmail } from "./patient-session";
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
  const patient = await getPatientEmail();
  if (patient) return { userId: patient.toLowerCase().trim(), role: "paciente" };
  return null;
}
