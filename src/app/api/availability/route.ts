import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { generateSlotsForDoctor, generateAvailableSlots } from "@/lib/scheduling";
import { logFinancialEvent, readDb, updateDb } from "@/lib/store";
import { activeHoldStarts } from "@/lib/holds-store";
import type { AvailabilityPeriod, Modality, WeeklySlot } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const modality = (searchParams.get("modality") || undefined) as Modality | undefined;
  const locationId = searchParams.get("locationId") || undefined;
  if (!doctorId) {
    return NextResponse.json({ error: "doctorId obrigatório" }, { status: 400 });
  }
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  }

  // Horários ocupados (consultas ativas) + reservados temporariamente (holds).
  const bookedStarts = db.bookings
    .filter((b) => b.doctorId === doctorId && ["pending_payment", "paid", "confirmed"].includes(b.status))
    .map((b) => new Date(b.slotStart).toISOString());
  const held = await activeHoldStarts(doctorId);
  const excludeStarts = new Set<string>([...bookedStarts, ...held]);

  const slots = generateAvailableSlots(doctor, { modality, locationId, excludeStarts });
  const locations = (doctor.locations || []).filter((l) => l.active);

  // Primeira disponibilidade (mais próxima) por modalidade/local.
  const firstAvailability = slots.slice(0, 6);

  return NextResponse.json({
    slots, // slots reais com modalidade/local/valor
    locations,
    firstAvailability,
    hasAdvancedAgenda: Boolean(doctor.availabilityPeriods && doctor.availabilityPeriods.length > 0),
    // Compatibilidade com telas antigas:
    weeklyAvailability: doctor.weeklyAvailability,
    legacySlots: generateSlotsForDoctor({ ...doctor, blockedSlots: [...doctor.blockedSlots, ...excludeStarts] }),
  });
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const body = await req.json();
  const weeklyAvailability = body.weeklyAvailability as WeeklySlot[] | undefined;
  const consultationPriceCents = body.consultationPriceCents as number | undefined;
  const bio = body.bio as string | undefined;
  const notifyWhatsapp = body.notifyWhatsapp !== undefined ? String(body.notifyWhatsapp || "").trim() : undefined;
  const useWhatsappNotifications =
    body.useWhatsappNotifications !== undefined ? Boolean(body.useWhatsappNotifications) : undefined;
  const patientContactWhatsapp =
    body.patientContactWhatsapp !== undefined ? String(body.patientContactWhatsapp || "").trim() : undefined;
  const allowPatientContact =
    body.allowPatientContact !== undefined ? Boolean(body.allowPatientContact) : undefined;
  const notifyNewBookings = body.notifyNewBookings !== undefined ? Boolean(body.notifyNewBookings) : undefined;
  const notifyPayments = body.notifyPayments !== undefined ? Boolean(body.notifyPayments) : undefined;
  const notifyReschedules = body.notifyReschedules !== undefined ? Boolean(body.notifyReschedules) : undefined;
  const notifyPush = body.notifyPush !== undefined ? Boolean(body.notifyPush) : undefined;
  const notifyReminder24 = body.notifyReminder24 !== undefined ? Boolean(body.notifyReminder24) : undefined;
  const notifyReminder2 = body.notifyReminder2 !== undefined ? Boolean(body.notifyReminder2) : undefined;
  const calendarEventMode = body.calendarEventMode === "patient" || body.calendarEventMode === "meurim" ? body.calendarEventMode : undefined;
  const tz = body.tz !== undefined ? String(body.tz || "").trim() || undefined : undefined;

  // Períodos avançados de agenda (local/modalidade/duração/intervalo/valor).
  let availabilityPeriods: AvailabilityPeriod[] | undefined;
  if (Array.isArray(body.availabilityPeriods)) {
    const isTime = (v: unknown) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
    availabilityPeriods = (body.availabilityPeriods as unknown[])
      .map((raw): AvailabilityPeriod | null => {
        const p = raw as Record<string, unknown>;
        const dow = Number(p.dayOfWeek);
        const modality = p.modality === "presencial" ? "presencial" : "teleconsulta";
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) return null;
        if (!isTime(p.start) || !isTime(p.end)) return null;
        if (modality === "presencial" && !p.locationId) return null;
        return {
          id: p.id ? String(p.id) : crypto.randomUUID(),
          dayOfWeek: dow,
          start: String(p.start),
          end: String(p.end),
          modality,
          locationId: modality === "presencial" ? String(p.locationId) : undefined,
          durationMin: Math.max(5, Math.round(Number(p.durationMin) || 30)),
          intervalMin: Math.max(0, Math.round(Number(p.intervalMin) || 0)),
          priceCents:
            p.priceCents === undefined || p.priceCents === null || p.priceCents === ""
              ? undefined
              : Math.max(0, Math.round(Number(p.priceCents))),
        };
      })
      .filter((p): p is AvailabilityPeriod => p !== null);
  }
  // Segurança: o médico NÃO pode alterar o próprio percentual de repasse nem a
  // liberação financeira — mesmo enviando esses campos diretamente na API, eles
  // são ignorados aqui. Só o administrador altera (via /api/admin/doctors).

  const db = await readDb();
  const before = db.doctors.find((d) => d.id === doctorId);
  const newPrice =
    typeof consultationPriceCents === "number" && Number.isFinite(consultationPriceCents)
      ? Math.max(0, Math.round(consultationPriceCents))
      : undefined;

  await updateDb((current) => ({
    ...current,
    doctors: current.doctors.map((d) =>
      d.id === doctorId
        ? {
            ...d,
            weeklyAvailability: weeklyAvailability ?? d.weeklyAvailability,
            consultationPriceCents: newPrice ?? d.consultationPriceCents,
            bio: bio ?? d.bio,
            notifyWhatsapp: notifyWhatsapp !== undefined ? notifyWhatsapp || undefined : d.notifyWhatsapp,
            useWhatsappNotifications:
              useWhatsappNotifications !== undefined ? useWhatsappNotifications : d.useWhatsappNotifications,
            patientContactWhatsapp:
              patientContactWhatsapp !== undefined ? patientContactWhatsapp || undefined : d.patientContactWhatsapp,
            allowPatientContact:
              allowPatientContact !== undefined ? allowPatientContact : d.allowPatientContact,
            notifyNewBookings: notifyNewBookings !== undefined ? notifyNewBookings : d.notifyNewBookings,
            notifyPayments: notifyPayments !== undefined ? notifyPayments : d.notifyPayments,
            notifyReschedules: notifyReschedules !== undefined ? notifyReschedules : d.notifyReschedules,
            notifyPush: notifyPush !== undefined ? notifyPush : d.notifyPush,
            notifyReminder24: notifyReminder24 !== undefined ? notifyReminder24 : d.notifyReminder24,
            notifyReminder2: notifyReminder2 !== undefined ? notifyReminder2 : d.notifyReminder2,
            calendarEventMode: calendarEventMode !== undefined ? calendarEventMode : d.calendarEventMode,
            tz: tz !== undefined ? tz : d.tz,
            availabilityPeriods: availabilityPeriods !== undefined ? availabilityPeriods : d.availabilityPeriods,
          }
        : d
    ),
  }));

  // Histórico do preço (o médico controla o próprio valor da consulta).
  if (before && newPrice !== undefined && newPrice !== before.consultationPriceCents) {
    await logFinancialEvent({
      doctorId,
      kind: "price",
      oldValue: String(before.consultationPriceCents),
      newValue: String(newPrice),
      changedBy: "medico",
    });
  }

  return NextResponse.json({ ok: true });
}
