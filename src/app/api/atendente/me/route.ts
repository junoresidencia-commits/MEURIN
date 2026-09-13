import { NextResponse } from "next/server";
import { getAttendantId } from "@/lib/attendant-session";
import { getAttendant, listLinksForAttendant } from "@/lib/attendants-store";
import { getDoctorById } from "@/lib/store";
import { getClinic, listMembershipsForActor } from "@/lib/platform-store";

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
  const memberships = await listMembershipsForActor("attendant", att.id);
  const clinics = [];
  for (const m of memberships.filter((x) => x.role === "ATENDENTE")) {
    const clinic = await getClinic(m.clinicId);
    if (clinic) clinics.push({ clinicId: clinic.id, clinicName: clinic.name });
  }
  return NextResponse.json({ attendant: { id: att.id, name: att.name, photoUrl: att.photoUrl ?? null }, doctors, clinics });
}
