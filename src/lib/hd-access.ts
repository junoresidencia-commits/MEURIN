import "server-only";
import { getDoctorSessionId } from "./auth";
import { getDoctorById } from "./store";
import { listActiveRoles } from "./platform-store";
import type { HdActor, HdMember, HdPermKey, HdPermMap, HdRole } from "./hd-types";

export const HD_ROLE_DEFAULTS: Record<HdRole, HdPermMap> = {
  MEDICO: {
    view_patients: true,
    view_exams: true,
    upload_exams: false,
    confirm_ocr: true,
    view_map: true,
    edit_access: true,
    edit_machine: true,
    edit_shift: true,
    edit_time: true,
    edit_capillary: true,
    edit_heparin: true,
    edit_prescription: true,
    review: true,
    close_month: true,
    view_history: true,
    view_audit: true,
    manage_team: false,
    manage_config: false,
    edit_protocols: false,
  },
  ENFERMAGEM: {
    view_patients: true,
    view_exams: true,
    upload_exams: false,
    confirm_ocr: false,
    view_map: true,
    edit_access: true,
    edit_machine: true,
    edit_shift: true,
    edit_time: true,
    edit_capillary: true,
    edit_heparin: false,
    edit_prescription: false,
    review: false,
    close_month: false,
    view_history: false,
    view_audit: false,
    manage_team: false,
    manage_config: false,
    edit_protocols: false,
  },
  LABORATORIO: {
    view_patients: true,
    view_exams: true,
    upload_exams: true,
    confirm_ocr: true,
    view_map: false,
    edit_access: false,
    edit_machine: false,
    edit_shift: false,
    edit_time: false,
    edit_capillary: false,
    edit_heparin: false,
    edit_prescription: false,
    review: false,
    close_month: false,
    view_history: false,
    view_audit: false,
    manage_team: false,
    manage_config: false,
    edit_protocols: false,
  },
  ADMIN: {
    view_patients: true,
    view_exams: true,
    upload_exams: true,
    confirm_ocr: true,
    view_map: true,
    edit_access: true,
    edit_machine: true,
    edit_shift: true,
    edit_time: true,
    edit_capillary: true,
    edit_heparin: true,
    edit_prescription: true,
    review: true,
    close_month: true,
    view_history: true,
    view_audit: true,
    manage_team: true,
    manage_config: true,
    edit_protocols: true,
  },
};

export function hdPerm(member: HdMember | null, key: HdPermKey, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  if (!member || member.status !== "active") return false;
  if (member.permissions[key] != null) return Boolean(member.permissions[key]);
  return HD_ROLE_DEFAULTS[member.role][key] === true;
}

export function resolvedPerms(member: HdMember | null, isSuperAdmin = false): Record<HdPermKey, boolean> {
  const keys = Object.keys(HD_ROLE_DEFAULTS.ADMIN) as HdPermKey[];
  const out = {} as Record<HdPermKey, boolean>;
  for (const k of keys) out[k] = hdPerm(member, k, isSuperAdmin);
  return out;
}

export async function getHdActor(): Promise<HdActor | null> {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return null;
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return null;
  let isSuperAdmin = false;
  try {
    const roles = await listActiveRoles("doctor", doctorId);
    isSuperAdmin = roles.includes("SUPER_ADMIN");
  } catch {
    isSuperAdmin = false;
  }
  return {
    doctorId,
    name: doctor.name,
    email: doctor.email,
    isSuperAdmin,
  };
}
