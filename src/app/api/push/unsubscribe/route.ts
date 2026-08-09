import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { removeDevice } from "@/lib/notifications-store";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) return NextResponse.json({ error: "Endpoint ausente." }, { status: 400 });
    await removeDevice(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push/unsubscribe", err);
    return NextResponse.json({ error: "Não foi possível desativar agora." }, { status: 500 });
  }
}
