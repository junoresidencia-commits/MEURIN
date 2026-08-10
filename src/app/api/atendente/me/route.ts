import { NextResponse } from "next/server";
import { getAttendantId } from "@/lib/attendant-session";
import { getAttendant, listLinksForAttendant } from "@/lib/attendants-store";
import { getDoctorById } from "@/lib/store";

export async function GET() {
  const id = await getAttendantId();
  if (!id) return NextResponse.json({ attendant: null }, { status: 200 });
  const att = await getAttendant(id);
  if (!att || att.status !== "active") return NextResponse.json({ attendant: null });
  const links = await listLinksForAttendant(id);
  const doctors = await Promise.all(links.map(async (l) => {
    const d = await getDoctorById(l.doctorId);
    return { doctorId: l.doctorId, doctorName: d?.name || "Médico", specialty: d?.specialty || "", permissions: l.permissions };
  }));
  return NextResponse.json({ attendant: { id: att.id, name: att.name }, doctors });
}
