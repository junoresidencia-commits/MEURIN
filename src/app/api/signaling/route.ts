import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { appendSignalingMessage, listSignalingForRoom } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");
  const after = searchParams.get("after") || "";
  if (!roomId) {
    return NextResponse.json({ error: "roomId obrigatório" }, { status: 400 });
  }
  const messages = await listSignalingForRoom(roomId, after);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { roomId, from, type, payload } = body;
  if (!roomId || !from || !type || !payload) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const message = {
    id: uuid(),
    roomId: String(roomId),
    from,
    type,
    payload: typeof payload === "string" ? payload : JSON.stringify(payload),
    createdAt: new Date().toISOString(),
  };

  await appendSignalingMessage(message);
  return NextResponse.json({ ok: true, message });
}
