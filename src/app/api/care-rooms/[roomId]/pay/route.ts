import { NextResponse } from "next/server";
import { carePixPayload, carePublic, confirmCareRoomPaid, declareCareRoomPaid } from "@/lib/care-room-access";
import { getCareRoomByMeetingId } from "@/lib/care-rooms-store";
import { getPatientEmail } from "@/lib/patient-session";

export async function GET(_req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Entre como paciente para ver o Pix." }, { status: 401 });
  const room = await getCareRoomByMeetingId(roomId);
  if (!room) return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
  const pix = await carePixPayload(room);
  return NextResponse.json({ ...carePublic(room), pix });
}

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await req.json().catch(() => ({}));
  const result = body.confirm ? await confirmCareRoomPaid(roomId) : await declareCareRoomPaid(roomId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...carePublic(result.room) });
}
