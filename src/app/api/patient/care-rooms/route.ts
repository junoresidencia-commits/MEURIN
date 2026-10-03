import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { carePublic, listPatientCareRooms } from "@/lib/care-room-access";

export async function GET() {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const rooms = await listPatientCareRooms();
  return NextResponse.json({ rooms: rooms.map(carePublic) });
}
