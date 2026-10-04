import { NextResponse } from "next/server";
import { carePublic, currentCareProfessional, listMyCareRooms, openCareRoomForPatient } from "@/lib/care-room-access";

export async function GET() {
  const actor = await currentCareProfessional();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const rooms = await listMyCareRooms();
  return NextResponse.json({ rooms: rooms.map(carePublic) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const patientKey = String(body.patientKey || "").trim();
    if (!patientKey) return NextResponse.json({ error: "Paciente obrigatório." }, { status: 400 });
    const result = await openCareRoomForPatient(patientKey, { isReturn: body.isReturn === true });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    if ("kind" in result.room && "id" in result.room) {
      return NextResponse.json({ ok: true, ...carePublic(result.room) });
    }
    return NextResponse.json({ ok: true, ...result.room });
  } catch (err) {
    console.error("[care-rooms] POST", err);
    return NextResponse.json({ error: "Não foi possível abrir a sala. Tente novamente em instantes." }, { status: 500 });
  }
}
