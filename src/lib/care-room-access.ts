import "server-only";
import QRCode from "qrcode";
import { requireAllied, resolveAlliedPatientAccess } from "./allied-access";
import { requireNutritionist, resolveNutritionPatientAccess } from "./nutrition-context";
import { getPatientEmail } from "./patient-session";
import { clinicalKey, findPatientByClinicalKey } from "./patients-store";
import { buildProfessionalPix } from "./pix-brcode";
import {
  CARE_META,
  createCareRoom,
  findReusableRoom,
  getCareRoomByMeetingId,
  listOpenRoomsForPatientKeys,
  listOpenRoomsForProfessional,
  touchCareRoom,
  updateCarePayment,
  type CareKind,
  type CareRoom,
} from "./care-rooms-store";
import type { PixProfile } from "./types";

export type CarePixInfo = {
  brCode: string;
  qrDataUrl: string;
  amountCents: number;
  holderName: string;
};

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

async function billingForActor(actor: NonNullable<CareActor>): Promise<
  { priceCents: number; pixProfile: PixProfile | null; name: string } | { error: string; status: number }
> {
  if (actor.kind === "nutrition") {
    const nut = await requireNutritionist();
    if (!nut) return { error: "Não autenticado.", status: 401 };
    if (nut.payoutStatus === "blocked") {
      return { error: "Seu recebimento está bloqueado. Fale com o administrador.", status: 403 };
    }
    return {
      priceCents: Math.max(0, Math.round(nut.consultationPriceCents ?? 0)),
      pixProfile: nut.pixProfile ?? null,
      name: nut.name,
    };
  }
  const pro = await requireAllied();
  if (!pro) return { error: "Não autenticado.", status: 401 };
  return {
    priceCents: Math.max(0, Math.round(pro.consultationPriceCents ?? 0)),
    pixProfile: pro.pixProfile ?? null,
    name: pro.name,
  };
}

export function careRoomNeedsPayment(room: CareRoom): boolean {
  return (room.priceCents ?? 0) > 0 && (room.paymentStatus === "unpaid" || !room.paymentStatus);
}

export async function carePixPayload(room: CareRoom): Promise<CarePixInfo | null> {
  if (!room.pixCopiaCola || !(room.priceCents > 0)) return null;
  const qrDataUrl = await QRCode.toDataURL(room.pixCopiaCola, {
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return {
    brCode: room.pixCopiaCola,
    qrDataUrl,
    amountCents: room.priceCents,
    holderName: room.pixHolderName || room.professionalName,
  };
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

  const billing = await billingForActor(actor);
  if ("error" in billing) return billing;
  if (billing.priceCents > 0 && !billing.pixProfile?.key?.trim()) {
    return {
      error: "Cadastre sua chave Pix em Configurações para cobrar a consulta. Sem Pix cadastrado o valor não pode ir para a sua conta.",
      status: 400,
    };
  }

  const room = await createCareRoom({
    kind: actor.kind,
    professionalId: actor.professionalId,
    professionalName: actor.professionalName,
    patientKey: key,
    patientName: name,
    patientEmail: email,
    priceCents: billing.priceCents,
    pixCopiaCola: null,
    pixHolderName: billing.name,
    paymentStatus: billing.priceCents > 0 ? "unpaid" : "free",
  });

  if (billing.priceCents > 0) {
    const charged = buildProfessionalPix(
      { name: billing.name, pixProfile: billing.pixProfile },
      { id: room.id, priceCents: billing.priceCents },
      billing.name
    );
    if (charged?.brCode) {
      const updated = await updateCarePayment(room.id, {
        pixCopiaCola: charged.brCode,
        pixHolderName: charged.holderName,
      });
      return { room: updated ?? { ...room, pixCopiaCola: charged.brCode, pixHolderName: charged.holderName } };
    }
  }
  return { room };
}

export async function declareCareRoomPaid(meetingRoomId: string): Promise<{ room: CareRoom } | { error: string; status: number }> {
  const subject = await getPatientEmail();
  if (!subject) return { error: "Entre como paciente para confirmar o Pix.", status: 401 };
  const room = await getCareRoomByMeetingId(meetingRoomId);
  if (!room || room.status !== "open") return { error: "Sala não encontrada.", status: 404 };

  const keys = new Set<string>([subject.toLowerCase().trim()]);
  const patient = await findPatientByClinicalKey(subject);
  if (patient) {
    keys.add(clinicalKey(patient));
    keys.add(`pid:${patient.id}`);
    if (patient.email) keys.add(patient.email.toLowerCase().trim());
  }
  const email = (room.patientEmail || "").toLowerCase().trim();
  const owns = keys.has(room.patientKey.toLowerCase().trim()) || (email && keys.has(email));
  if (!owns) return { error: "Esta consulta não é sua.", status: 403 };

  if (!careRoomNeedsPayment(room)) return { room };
  const updated = await updateCarePayment(room.id, { paymentStatus: "declared" });
  return { room: updated ?? { ...room, paymentStatus: "declared" } };
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
    priceCents: room.priceCents ?? 0,
    paymentStatus: room.paymentStatus ?? "free",
    pixHolderName: room.pixHolderName || room.professionalName,
    paymentRequired: careRoomNeedsPayment(room),
  };
}
