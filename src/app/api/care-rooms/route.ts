import { NextResponse } from "next/server";
import { carePublic, currentCareProfessional, listMyCareRooms, openCareRoomForPatient } from "@/lib/care-room-access";

export async function GET() {
  const actor = await currentCareProfessional();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const rooms = await listMyCareRooms();
  return NextResponse.json({ rooms: rooms.map(carePublic) });
}

export async function POST(req: Request) {
  const actor = await currentCareProfessional();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const patientKey = String(body.patientKey || "").trim();
  if (!patientKey) return NextResponse.json({ error: "Paciente obrigatório." }, { status: 400 });
  const result = await openCareRoomForPatient(patientKey);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...carePublic(result.room) });
}
