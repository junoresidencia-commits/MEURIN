import { NextResponse } from "next/server";
import { getBookingByRoomId } from "@/lib/store";
import { getCareRoomByMeetingId } from "@/lib/care-rooms-store";
import { listRoomPresence, upsertRoomPresence, type PresenceRole } from "@/lib/room-presence";

async function roomExists(roomId: string) {
  const booking = await getBookingByRoomId(roomId);
  if (booking) return true;
  const care = await getCareRoomByMeetingId(roomId);
  return Boolean(care);
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  if (!(await roomExists(roomId))) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const peers = await listRoomPresence(roomId);
  return NextResponse.json({
    doctor: peers.find((p) => p.role === "doctor") || null,
    patient: peers.find((p) => p.role === "patient") || null,
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await context.params;
  if (!(await roomExists(roomId))) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const role = body.role === "doctor" ? "doctor" : body.role === "patient" ? "patient" : null;
  if (!role) {
    return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
  }
  const row = await upsertRoomPresence({
    roomId,
    role: role as PresenceRole,
    pageOpen: body.pageOpen !== false,
    inCall: body.inCall === true,
  });
  const peers = await listRoomPresence(roomId);
  return NextResponse.json({
    ok: true,
    you: row,
    doctor: peers.find((p) => p.role === "doctor") || null,
    patient: peers.find((p) => p.role === "patient") || null,
  });
}
