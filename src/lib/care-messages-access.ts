import "server-only";
import { getPatientEmail } from "./patient-session";
import { clinicalKey, findByEmailAny, getPatient } from "./patients-store";
import { requireNutritionist, resolveNutritionPatientAccess } from "./nutrition-context";
import { requireAllied, resolveAlliedPatientAccess } from "./allied-access";
import { listReferralsForPatient } from "./nutritionists-store";
import { listAlliedReferralsForPatient } from "./allied-store";
import type { NotifyRole } from "./types";
import type { CareChatRole, CareMessageSender } from "./care-messages-store";
import { isAlliedRole, ROLE_META } from "./allied-types";

export function isCareChatRole(s: string): s is CareChatRole {
  return s === "nutrition" || isAlliedRole(s);
}

export function notifyRoleForCare(role: CareChatRole): NotifyRole {
  if (role === "nutrition") return "nutricionista";
  return ROLE_META[role].notify;
}

export function professionalChatUrl(role: CareChatRole, patientKey: string) {
  const enc = encodeURIComponent(patientKey);
  if (role === "nutrition") return `/nutricionista/paciente/${enc}#mensagens`;
  return `${ROLE_META[role].path}/paciente/${enc}#mensagens`;
}

export function careRoleLabel(role: CareChatRole) {
  if (role === "nutrition") return "nutricionista";
  return ROLE_META[role].careLabel;
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
  const patientKeys = normalizePatientKey(input.patientKey || "");

  if (role === "nutrition") {
    const nut = await requireNutritionist();
    if (nut) {
      if (patientKeys.length === 0) return null;
      for (const patientKey of patientKeys) {
        const access = await resolveNutritionPatientAccess(patientKey);
        if (!access?.allowed) continue;
        return {
          role, professionalId: nut.id, patientKey: access.key,
          patientNotifyId: access.key, patientName: access.name, sender: "professional",
        };
      }
      return null;
    }
  } else {
    const pro = await requireAllied(role);
    if (pro) {
      if (patientKeys.length === 0) return null;
      for (const patientKey of patientKeys) {
        const access = await resolveAlliedPatientAccess(patientKey, pro);
        if (!access?.allowed) continue;
        return {
          role, professionalId: pro.id, patientKey: access.key,
          patientNotifyId: access.key, patientName: access.name, sender: "professional",
        };
      }
      return null;
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

function normalizePatientKey(raw: string): string[] {
  let k = String(raw || "").trim();
  if (!k) return [];
  try { k = decodeURIComponent(k); } catch { /* keep raw */ }
  const out = new Set<string>([k]);
  if (k.startsWith("pid:")) out.add(k.slice(4));
  else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(k)) out.add(`pid:${k}`);
  return [...out];
}
