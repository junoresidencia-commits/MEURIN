import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const db = await readDb();
  const mine = db.bookings.filter((b) => b.doctorId === doctorId);

  const byEmail = new Map<
    string,
    {
      email: string;
      name: string;
      city: string;
      total: number;
      lastSlot: string;
      nextSlot: string | null;
    }
  >();

  const now = Date.now();
  for (const b of mine) {
    const key = b.patientEmail.toLowerCase();
    const entry = byEmail.get(key) || {
      email: key,
      name: b.patientName,
      city: b.patientCity,
      total: 0,
      lastSlot: b.slotStart,
      nextSlot: null,
    };
    entry.total += 1;
    if (b.slotStart > entry.lastSlot) {
      entry.lastSlot = b.slotStart;
      entry.name = b.patientName;
      entry.city = b.patientCity;
    }
    const t = new Date(b.slotStart).getTime();
    if (t > now && (!entry.nextSlot || b.slotStart < entry.nextSlot)) {
      entry.nextSlot = b.slotStart;
    }
    byEmail.set(key, entry);
  }

  const patients = Array.from(byEmail.values()).sort((a, b) =>
    b.lastSlot.localeCompare(a.lastSlot)
  );

  return NextResponse.json({ patients });
}
