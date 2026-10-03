import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getPatientEmail } from "@/lib/patient-session";
import { getBookingByRoomId, getDoctorById } from "@/lib/store";
import { clinicalKey, findPatientByClinicalKey } from "@/lib/patients-store";
import type { Booking } from "@/lib/types";
import { CARE_META, getCareRoomByMeetingId, type CareKind, type CareRoom } from "@/lib/care-rooms-store";
import { carePixPayload, careRoomAwaitingHost, careRoomNeedsPayment, currentCareProfessional } from "@/lib/care-room-access";

export type RoomRole = "doctor" | "patient" | "guest";
export type RoomKind = "doctor" | CareKind;

async function resolveDoctorBookingRole(booking: Booking): Promise<RoomRole> {
  const doctorId = await getDoctorSessionId();
  if (doctorId && doctorId === booking.doctorId) return "doctor";

  const subject = await getPatientEmail();
  if (subject) {
    const bookingKey = booking.patientEmail.toLowerCase().trim();
    if (subject.toLowerCase() === bookingKey) return "patient";
    const patient = await findPatientByClinicalKey(subject);
    if (patient) {
      const key = clinicalKey(patient);
      if (key === bookingKey || (patient.email && patient.email.toLowerCase() === bookingKey)) {
        return "patient";
      }
    }
  }
  return "guest";
}

async function resolveCareRoomRole(room: CareRoom): Promise<RoomRole> {
  const actor = await currentCareProfessional();
  if (actor && actor.professionalId === room.professionalId) return "doctor";

  const subject = await getPatientEmail();
  if (subject) {
    const keys = new Set<string>([subject.toLowerCase().trim()]);
    const patient = await findPatientByClinicalKey(subject);
    if (patient) {
      keys.add(clinicalKey(patient));
      keys.add(`pid:${patient.id}`);
      if (patient.email) keys.add(patient.email.toLowerCase().trim());
    }
    const email = (room.patientEmail || "").toLowerCase().trim();
    if (keys.has(room.patientKey.toLowerCase().trim()) || (email && keys.has(email))) {
      return "patient";
    }
  }
  return "guest";
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  const booking = await getBookingByRoomId(roomId);
  if (booking) {
    if (!["confirmed", "completed"].includes(booking.status)) {
      const msg =
        booking.status === "paid"
          ? "Pagamento recebido. A sala abre quando o médico confirmar a consulta."
          : "Consulta liberada somente após o pagamento e a confirmação do médico.";
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    const [doctor, you] = await Promise.all([getDoctorById(booking.doctorId), resolveDoctorBookingRole(booking)]);
    return NextResponse.json({
      you: { role: you },
      kind: "doctor" as RoomKind,
      hostLabel: "Médico",
      homePath: "/medicos/agenda",
      loginPath: "/medicos/login",
      booking: {
        id: booking.id,
        patientName: booking.patientName,
        patientEmail: you === "doctor" ? booking.patientEmail : undefined,
        patientKey: you === "doctor" ? booking.patientEmail : undefined,
        careReason: booking.careReason,
        slotStart: booking.slotStart,
        slotEnd: booking.slotEnd,
        status: booking.status,
        meetingRoomId: booking.meetingRoomId,
      },
      doctor: doctor
        ? { id: doctor.id, name: doctor.name, crm: doctor.crm }
        : null,
    });
  }

  const care = await getCareRoomByMeetingId(roomId);
  if (!care || care.status !== "open") {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const you = await resolveCareRoomRole(care);
  const meta = CARE_META[care.kind];
  const unpaid = careRoomNeedsPayment(care);
  const awaitingHost = careRoomAwaitingHost(care);
  if (you !== "doctor" && unpaid) {
    const pix = you === "patient" ? await carePixPayload(care) : null;
    return NextResponse.json(
      {
        error:
          you === "patient"
            ? "Pague o Pix da consulta para entrar na sala. O valor vai para a chave cadastrada do profissional."
            : "Entre como paciente para pagar o Pix e acessar a sala.",
        paymentRequired: true,
        kind: care.kind,
        hostLabel: meta.label,
        homePath: meta.path,
        loginPath: "/paciente/entrar",
        professionalName: care.professionalName,
        isReturn: care.isReturn === true,
        pix,
      },
      { status: 403 }
    );
  }
  if (you !== "doctor" && awaitingHost) {
    return NextResponse.json(
      {
        error: "Pix enviado. O profissional vai conferir na conta e liberar a sala.",
        awaitingHost: true,
        kind: care.kind,
        hostLabel: meta.label,
        professionalName: care.professionalName,
        priceCents: care.priceCents ?? 0,
      },
      { status: 403 }
    );
  }
  return NextResponse.json({
    you: { role: you },
    kind: care.kind,
    hostLabel: meta.label,
    homePath: meta.path,
    loginPath: meta.login,
    payment: {
      status: care.paymentStatus,
      priceCents: care.priceCents ?? 0,
      holderName: care.pixHolderName || care.professionalName,
      isReturn: care.isReturn === true,
    },
    booking: {
      id: care.id,
      patientName: care.patientName,
      patientEmail: you === "doctor" ? care.patientEmail || care.patientKey : undefined,
      patientKey: you === "doctor" ? care.patientKey : undefined,
      careReason: undefined,
      slotStart: care.createdAt,
      slotEnd: undefined,
      status: unpaid || awaitingHost ? "pending_payment" : "confirmed",
      meetingRoomId: care.meetingRoomId,
    },
    doctor: { id: care.professionalId, name: care.professionalName, crm: "" },
  });
}
