import "server-only";
import { requireAllied, resolveAlliedPatientAccess } from "./allied-access";
import { requireNutritionist, resolveNutritionPatientAccess } from "./nutrition-context";
import { getPatientEmail } from "./patient-session";
import { clinicalKey, findPatientByClinicalKey } from "./patients-store";
import {
  CARE_META,
  createCareRoom,
  findReusableRoom,
  listOpenRoomsForPatientKeys,
  listOpenRoomsForProfessional,
  touchCareRoom,
  type CareKind,
  type CareRoom,
} from "./care-rooms-store";

export type CareActor =
  | { kind: CareKind; professionalId: string; professionalName: string }
  | null;

export async function currentCareProfessional(): Promise<CareActor> {
  const allied = await requireAllied();
  if (allied) {
    return {
      kind: allied.role,
      professionalId: allied.id,
      professionalName: allied.name,
    };
  }
  const nut = await requireNutritionist();
  if (nut) {
    return { kind: "nutrition", professionalId: nut.id, professionalName: nut.name };
  }
  return null;
}

export async function openCareRoomForPatient(patientKey: string): Promise<{ room: CareRoom } | { error: string; status: number }> {
  const actor = await currentCareProfessional();
  if (!actor) return { error: "Não autenticado.", status: 401 };

  let name = "Paciente";
  let key = patientKey;
  let email: string | null = null;

  if (actor.kind === "nutrition") {
    const access = await resolveNutritionPatientAccess(patientKey);
    if (!access) return { error: "Sem acesso a este paciente.", status: 403 };
    name = access.name;
    key = access.key;
  } else {
    const access = await resolveAlliedPatientAccess(patientKey);
    if (!access) return { error: "Sem acesso a este paciente.", status: 403 };
    name = access.name;
    key = access.key;
  }

  const patient = await findPatientByClinicalKey(key);
  if (patient?.email) email = patient.email.toLowerCase().trim();
  else if (key.includes("@")) email = key.toLowerCase().trim();

  const existing = await findReusableRoom(actor.professionalId, key);
  if (existing) {
    await touchCareRoom(existing.id);
    return { room: existing };
  }

  const room = await createCareRoom({
    kind: actor.kind,
    professionalId: actor.professionalId,
    professionalName: actor.professionalName,
    patientKey: key,
    patientName: name,
    patientEmail: email,
  });
  void doctorId;
  return { room };
}

export async function listMyCareRooms(): Promise<CareRoom[]> {
  const actor = await currentCareProfessional();
  if (!actor) return [];
  return listOpenRoomsForProfessional(actor.professionalId);
}

export async function listPatientCareRooms(): Promise<CareRoom[]> {
  const subject = await getPatientEmail();
  if (!subject) return [];
  const keys = new Set<string>([subject.toLowerCase().trim()]);
  const patient = await findPatientByClinicalKey(subject);
  if (patient) {
    keys.add(clinicalKey(patient));
    keys.add(`pid:${patient.id}`);
    if (patient.email) keys.add(patient.email.toLowerCase().trim());
  }
  return listOpenRoomsForPatientKeys([...keys]);
}

export function carePublic(room: CareRoom) {
  const meta = CARE_META[room.kind];
  return {
    id: room.id,
    meetingRoomId: room.meetingRoomId,
    kind: room.kind,
    area: meta.area,
    hostLabel: meta.label,
    professionalName: room.professionalName,
    patientName: room.patientName,
    patientKey: room.patientKey,
    createdAt: room.createdAt,
    href: `/consulta/${room.meetingRoomId}`,
  };
}
