import "server-only";
import { getPatientEmail } from "./patient-session";
import { clinicalKey, findByEmailAny, getPatient } from "./patients-store";
import { requireNutritionist, resolveNutritionPatientAccess } from "./nutrition-context";
import { requireAllied, resolveAlliedPatientAccess } from "./allied-access";
import { listReferralsForPatient } from "./nutritionists-store";
import { listAlliedReferralsForPatient } from "./allied-store";
import type { NotifyRole } from "./types";
import type { CareChatRole, CareMessageSender } from "./care-messages-store";

export function isCareChatRole(s: string): s is CareChatRole {
  return s === "nutrition" || s === "psychology" || s === "nursing";
}

export function notifyRoleForCare(role: CareChatRole): NotifyRole {
  if (role === "nutrition") return "nutricionista";
  if (role === "psychology") return "psicologo";
  return "enfermeiro";
}

export function professionalChatUrl(role: CareChatRole, patientKey: string) {
  const enc = encodeURIComponent(patientKey);
  if (role === "nutrition") return `/nutricionista/paciente/${enc}#mensagens`;
  if (role === "psychology") return `/psicologo/paciente/${enc}#mensagens`;
  return `/enfermeiro/paciente/${enc}#mensagens`;
}

export function careRoleLabel(role: CareChatRole) {
  if (role === "nutrition") return "nutricionista";
  if (role === "psychology") return "psicólogo(a)";
  return "enfermeiro(a)";
}

export interface CareThreadAccess {
  role: CareChatRole;
  professionalId: string;
  patientKey: string;
  patientNotifyId: string;
  patientName: string;
  sender: CareMessageSender;
}

async function loadPatientFromSession() {
  const subject = await getPatientEmail();
  if (!subject) return null;
  const patient = subject.startsWith("pid:") ? await getPatient(subject.slice(4)) : await findByEmailAny(subject);
  if (!patient) return null;
  const key = clinicalKey(patient);
  const keys = [...new Set([key, subject, patient.email?.toLowerCase() || ""].filter(Boolean))];
  return { patient, key, keys, notifyId: subject.toLowerCase().trim() };
}

async function patientHasOpenReferral(keys: string[], role: CareChatRole, professionalId: string): Promise<boolean> {
  for (const k of keys) {
    if (role === "nutrition") {
      const refs = await listReferralsForPatient(k);
      if (refs.some((r) => r.status !== "encerrado" && r.nutritionistId === professionalId)) return true;
    } else {
      const refs = await listAlliedReferralsForPatient(k);
      if (refs.some((r) => r.status !== "encerrado" && r.role === role && r.professionalId === professionalId)) return true;
    }
  }
  return false;
}

export async function resolveCareThread(input: {
  role: string;
  professionalId?: string;
  patientKey?: string;
}): Promise<CareThreadAccess | null> {
  if (!isCareChatRole(input.role)) return null;
  const role = input.role;

  if (role === "nutrition") {
    const nut = await requireNutritionist();
    if (nut) {
      const patientKey = String(input.patientKey || "");
      if (!patientKey) return null;
      const access = await resolveNutritionPatientAccess(patientKey);
      if (!access?.allowed) return null;
      return {
        role, professionalId: nut.id, patientKey: access.key,
        patientNotifyId: access.key, patientName: access.name, sender: "professional",
      };
    }
  } else {
    const pro = await requireAllied(role);
    if (pro) {
      const patientKey = String(input.patientKey || "");
      if (!patientKey) return null;
      const access = await resolveAlliedPatientAccess(patientKey, pro);
      if (!access?.allowed) return null;
      return {
        role, professionalId: pro.id, patientKey: access.key,
        patientNotifyId: access.key, patientName: access.name, sender: "professional",
      };
    }
  }

  const session = await loadPatientFromSession();
  if (!session) return null;
  const professionalId = String(input.professionalId || "");
  if (!professionalId) return null;
  const ok = await patientHasOpenReferral(session.keys, role, professionalId);
  if (!ok) return null;
  return {
    role, professionalId, patientKey: session.key,
    patientNotifyId: session.notifyId, patientName: session.patient.name, sender: "patient",
  };
}
