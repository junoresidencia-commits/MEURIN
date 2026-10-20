import { NextResponse } from "next/server";
import { requireAttendantForDoctor, hasPerm } from "@/lib/attendant-context";
import { getAttendantId } from "@/lib/attendant-session";
import { listBookingsForDoctor, getDoctorById, updateDb } from "@/lib/store";
import { listLinksForAttendant } from "@/lib/attendants-store";
import { logAttendantAudit } from "@/lib/attendants-store";
import { parseAvailabilityPeriods } from "@/lib/availability-periods";

async function resolveDoctorId(raw: string): Promise<string> {
  const asked = String(raw || "").trim();
  if (asked) return asked;
  const attendantId = await getAttendantId();
  if (!attendantId) return "";
  const links = await listLinksForAttendant(attendantId);
  return links[0]?.doctorId || "";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const doctorId = await resolveDoctorId(searchParams.get("doctorId") || "");
  if (!doctorId) return NextResponse.json({ error: "Sem médico vinculado." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "agenda")) return NextResponse.json({ error: "Sem permissão para ver a agenda." }, { status: 403 });

  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const [doctor, list] = await Promise.all([getDoctorById(doctorId), listBookingsForDoctor(doctorId, from, to)]);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  const bookings = list
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
    .map((b) => ({
      id: b.id,
      patientName: b.patientName,
      patientPhone: b.patientPhone,
      patientEmail: b.patientEmail,
      slotStart: b.slotStart,
      slotEnd: b.slotEnd,
      status: b.status,
      stage: b.stage ?? null,
      modality: b.modality ?? null,
      locationName: b.locationName ?? null,
      meetingRoomId: b.meetingRoomId,
    }));

  return NextResponse.json({
    doctor: { id: doctor.id, name: doctor.name, tz: doctor.tz || "America/Bahia" },
    bookings,
    availabilityPeriods: doctor.availabilityPeriods || [],
    locations: (doctor.locations || []).map((l) => ({ id: l.id, name: l.name, city: l.city, active: l.active })),
    blockedSlots: doctor.blockedSlots || [],
    permissions: ctx.link.permissions,
  });
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = await resolveDoctorId(String(b.doctorId || ""));
  if (!doctorId) return NextResponse.json({ error: "Sem médico vinculado." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "agenda")) return NextResponse.json({ error: "Sem permissão para montar a agenda." }, { status: 403 });

  const periods = parseAvailabilityPeriods(b.availabilityPeriods);
  const blocked = Array.isArray(b.blockedSlots)
    ? (b.blockedSlots as unknown[]).map((s) => String(s)).filter((s) => !Number.isNaN(new Date(s).getTime()))
    : undefined;

  await updateDb((current) => ({
    ...current,
    doctors: current.doctors.map((d) =>
      d.id === doctorId
        ? {
            ...d,
            availabilityPeriods: periods,
            blockedSlots: blocked !== undefined ? blocked : d.blockedSlots,
          }
        : d
    ),
  }));
  try {
    await logAttendantAudit({
      attendantId: ctx.attendant.id,
      attendantName: ctx.attendant.name,
      doctorId,
      action: "configurar_agenda",
      detail: `Atualizou a agenda do médico (${periods.length} períodos).`,
    });
  } catch {
    /* auditoria não derruba o save */
  }
  return NextResponse.json({ ok: true, periods: periods.length });
}

export async function PATCH(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = await resolveDoctorId(String(b.doctorId || ""));
  if (!doctorId) return NextResponse.json({ error: "Sem médico vinculado." }, { status: 400 });
  const ctx = await requireAttendantForDoctor(doctorId);
  if (!ctx) return NextResponse.json({ error: "Sem acesso a este médico." }, { status: 403 });
  if (!hasPerm(ctx.link, "agenda")) return NextResponse.json({ error: "Sem permissão para ajustar a agenda." }, { status: 403 });

  const action = String(b.action || "");
  const slotStart = String(b.slotStart || "");
  const iso = slotStart ? new Date(slotStart).toISOString() : "";
  if ((action === "block" || action === "unblock") && !iso) {
    return NextResponse.json({ error: "Informe o horário." }, { status: 400 });
  }

  await updateDb((current) => ({
    ...current,
    doctors: current.doctors.map((d) => {
      if (d.id !== doctorId) return d;
      const set = new Set(d.blockedSlots || []);
      if (action === "block") set.add(iso);
      if (action === "unblock") set.delete(iso);
      return { ...d, blockedSlots: Array.from(set) };
    }),
  }));
  return NextResponse.json({ ok: true });
}
