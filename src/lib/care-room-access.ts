import "server-only";
import { v4 as uuid } from "uuid";
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
import { alliedFeeRule } from "./allied-store";
import { nutritionFeeRule } from "./nutritionists-store";
import { recordPlatformCharge } from "./platform-charges-store";
import { getDoctorSessionId } from "./auth";
import { getDoctorById, listBookingsForDoctor, updateDb } from "./store";
import { resolvePatientAccess } from "./doctor-access";
import { doctorFeeRule, type Booking } from "./types";

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

async function openDoctorInstantRoom(
  patientKey: string,
  isReturn: boolean
): Promise<{ room: { meetingRoomId: string; isReturn: boolean; priceCents: number; paymentStatus: string } } | { error: string; status: number }> {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return { error: "Não autenticado.", status: 401 };
  const doctor = await getDoctorById(doctorId);
  const access = await resolvePatientAccess(patientKey);
  if (!doctor || !access?.allowed) {
    return { error: "Sem acesso a este paciente.", status: 403 };
  }

  const now = Date.now();
  const mine = await listBookingsForDoctor(doctor.id);
  const reusable = mine.find((b) => {
    if (!["confirmed", "paid", "completed"].includes(b.status)) return false;
    const email = (b.patientEmail || "").toLowerCase().trim();
    const same =
      email === access.email.toLowerCase().trim() ||
      email === access.key.toLowerCase().trim() ||
      access.key.toLowerCase() === email;
    const sameVisit = isReturn ? b.courtesyKind === "retorno" : !b.courtesyKind;
    const recent = now - new Date(b.createdAt || b.slotStart).getTime() < 12 * 60 * 60 * 1000;
    return same && sameVisit && recent && b.meetingRoomId;
  });
  if (reusable) {
    return {
      room: {
        meetingRoomId: reusable.meetingRoomId,
        isReturn,
        priceCents: reusable.priceCents ?? 0,
        paymentStatus: reusable.priceCents ? "confirmed" : "free",
      },
    };
  }

  const start = new Date();
  const booking: Booking = {
    id: uuid(),
    doctorId: doctor.id,
    patientName: access.name || "Paciente",
    patientEmail: (access.email || access.key).toLowerCase(),
    patientPhone: access.phone || "",
    patientCity: access.city || "",
    careReason: "acompanhamento",
    slotStart: start.toISOString(),
    slotEnd: new Date(start.getTime() + 30 * 60000).toISOString(),
    priceCents: isReturn ? 0 : doctor.consultationPriceCents,
    paymentMethod: "pix",
    status: "confirmed",
    meetingRoomId: uuid(),
    confirmationEmailSent: false,
    createdAt: start.toISOString(),
    courtesyKind: isReturn ? "retorno" : undefined,
    stage: "confirmada",
    events: [
      {
        at: start.toISOString(),
        actor: "medico",
        type: "confirmada",
        detail: isReturn ? "Retorno online iniciado pelo médico. Sem cobrança." : "Consulta online iniciada pelo médico.",
      },
    ],
  };
  await updateDb((current) => ({ ...current, bookings: [...current.bookings, booking] }));
  await recordPlatformCharge({
    actorKind: "doctor",
    professionalId: doctor.id,
    professionalName: doctor.name,
    kind: "atendimento",
    sourceId: booking.id,
    rule: doctorFeeRule(doctor),
    priceCents: booking.priceCents,
    note: isReturn ? "retorno" : "consulta médica",
  }).catch(() => null);
  return {
    room: {
      meetingRoomId: booking.meetingRoomId,
      isReturn,
      priceCents: booking.priceCents,
      paymentStatus: booking.priceCents > 0 ? "confirmed" : "free",
    },
  };
}

async function billingForActor(
  actor: NonNullable<CareActor>,
  isReturn: boolean
): Promise<{ priceCents: number; pixProfile: PixProfile | null; name: string } | { error: string; status: number }> {
  if (actor.kind === "nutrition") {
    const nut = await requireNutritionist();
    if (!nut) return { error: "Não autenticado.", status: 401 };
    if (nut.payoutStatus === "blocked") {
      return { error: "Seu recebimento está bloqueado. Fale com o administrador.", status: 403 };
    }
    const price = isReturn ? (nut.returnPriceCents ?? 0) : (nut.consultationPriceCents ?? 0);
    return {
      priceCents: Math.max(0, Math.round(price)),
      pixProfile: nut.pixProfile ?? null,
      name: nut.name,
    };
  }
  const pro = await requireAllied();
  if (!pro) return { error: "Não autenticado.", status: 401 };
  if (pro.payoutStatus === "blocked") {
    return { error: "Seu recebimento está bloqueado. Fale com o administrador.", status: 403 };
  }
  const price = isReturn ? (pro.returnPriceCents ?? 0) : (pro.consultationPriceCents ?? 0);
  return {
    priceCents: Math.max(0, Math.round(price)),
    pixProfile: pro.pixProfile ?? null,
    name: pro.name,
  };
}

export function careRoomNeedsPayment(room: CareRoom): boolean {
  return (room.priceCents ?? 0) > 0 && (room.paymentStatus === "unpaid" || !room.paymentStatus);
}

export function careRoomAwaitingHost(room: CareRoom): boolean {
  return (room.priceCents ?? 0) > 0 && room.paymentStatus === "declared";
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

export async function openCareRoomForPatient(
  patientKey: string,
  opts: { isReturn?: boolean } = {}
): Promise<{ room: CareRoom | { meetingRoomId: string; isReturn: boolean; priceCents: number; paymentStatus: string } } | { error: string; status: number }> {
  const actor = await currentCareProfessional();
  if (!actor) {
    const doctorId = await getDoctorSessionId();
    if (doctorId) return openDoctorInstantRoom(patientKey, opts.isReturn === true);
    return { error: "Não autenticado.", status: 401 };
  }

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

  const isReturn = opts.isReturn === true;
  const existing =
    (await findReusableRoom(actor.professionalId, key, isReturn)) ||
    (email ? await findReusableRoom(actor.professionalId, email, isReturn) : null) ||
    (await findReusableRoom(actor.professionalId, patientKey, isReturn));
  if (existing) {
    await touchCareRoom(existing.id);
    return { room: existing };
  }
  const billing = await billingForActor(actor, isReturn);
  if ("error" in billing) return billing;
  if (billing.priceCents > 0 && !billing.pixProfile?.key?.trim()) {
    return {
      error: "Cadastre sua chave Pix em Configurações para cobrar a consulta. Sem Pix cadastrado o valor não pode ir para a sua conta.",
      status: 400,
    };
  }

  let room: CareRoom;
  try {
    room = await createCareRoom({
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
      isReturn,
    });
  } catch (err) {
    console.error("[care-room] create failed", err);
    return { error: "Não foi possível abrir a sala. Tente novamente em instantes.", status: 500 };
  }

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
  if (billing.priceCents <= 0) {
    await recordAttendanceFee(actor, room.id, 0, isReturn ? "retorno" : "consulta");
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

export async function confirmCareRoomPaid(meetingRoomId: string): Promise<{ room: CareRoom } | { error: string; status: number }> {
  const actor = await currentCareProfessional();
  if (!actor) return { error: "Entre como profissional para conferir o Pix.", status: 401 };
  const room = await getCareRoomByMeetingId(meetingRoomId);
  if (!room || room.status !== "open") return { error: "Sala não encontrada.", status: 404 };
  if (actor.professionalId !== room.professionalId) return { error: "Só quem recebe o Pix pode confirmar.", status: 403 };
  if ((room.priceCents ?? 0) <= 0 || room.paymentStatus === "free") {
    await recordAttendanceFee(actor, room.id, room.priceCents ?? 0, room.isReturn ? "retorno" : "consulta");
    return { room };
  }
  const updated = await updateCarePayment(room.id, { paymentStatus: "confirmed" });
  await recordAttendanceFee(actor, room.id, room.priceCents ?? 0, room.isReturn ? "retorno" : "consulta");
  return { room: updated ?? { ...room, paymentStatus: "confirmed" } };
}

async function recordAttendanceFee(
  actor: NonNullable<CareActor>,
  sourceId: string,
  priceCents: number,
  note: string
) {
  try {
    if (actor.kind === "nutrition") {
      const nut = await requireNutritionist();
      if (!nut) return;
      await recordPlatformCharge({
        actorKind: "nutrition",
        professionalId: nut.id,
        professionalName: nut.name,
        kind: "atendimento",
        sourceId,
        rule: nutritionFeeRule(nut),
        priceCents,
        note,
      });
      return;
    }
    const pro = await requireAllied();
    if (!pro) return;
    await recordPlatformCharge({
      actorKind: pro.role,
      professionalId: pro.id,
      professionalName: pro.name,
      kind: "atendimento",
      sourceId,
      rule: alliedFeeRule(pro),
      priceCents,
      note,
    });
  } catch {
    /* cobrança da plataforma não bloqueia a consulta */
  }
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
    awaitingHost: careRoomAwaitingHost(room),
    isReturn: room.isReturn === true,
  };
}
