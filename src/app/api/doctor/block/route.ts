import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";

/** Bloqueia/desbloqueia um horário na agenda do médico (não aparece ao paciente). */
export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const start = String(b.slotStart || "");
  const t = new Date(start).getTime();
  if (Number.isNaN(t)) return NextResponse.json({ error: "Horário inválido." }, { status: 400 });
  const iso = new Date(t).toISOString();
  await updateDb((db) => ({
    ...db,
    doctors: db.doctors.map((d) =>
      d.id === doctorId
        ? { ...d, blockedSlots: Array.from(new Set([...(d.blockedSlots || []), iso])) }
        : d
    ),
  }));
  return NextResponse.json({ ok: true, slotStart: iso });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const iso = new Date(String(b.slotStart || "")).toISOString();
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  await updateDb((cur) => ({
    ...cur,
    doctors: cur.doctors.map((d) =>
      d.id === doctorId ? { ...d, blockedSlots: (d.blockedSlots || []).filter((s) => new Date(s).toISOString() !== iso) } : d
    ),
  }));
  return NextResponse.json({ ok: true });
}
