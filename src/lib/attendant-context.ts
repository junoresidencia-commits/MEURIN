import "server-only";
import { getAttendantId } from "./attendant-session";
import { getAttendant, getLink, type Attendant, type AttendantLink, type AttendantPermissions } from "./attendants-store";

export interface AttendantContext {
  attendant: Attendant;
  link: AttendantLink;
}

/** Resolve a atendente logada e o vínculo ATIVO com o médico alvo. Aplica menor privilégio:
 *  sem vínculo ativo => sem acesso àquele médico. */
export async function requireAttendantForDoctor(doctorId: string): Promise<AttendantContext | null> {
  const attendantId = await getAttendantId();
  if (!attendantId) return null;
  const attendant = await getAttendant(attendantId);
  if (!attendant || attendant.status !== "active") return null;
  const link = await getLink(attendantId, doctorId);
  if (!link || !link.active) return null;
  return { attendant, link };
}

export function hasPerm(link: AttendantLink, perm: keyof AttendantPermissions): boolean {
  return Boolean(link.permissions?.[perm]);
}
