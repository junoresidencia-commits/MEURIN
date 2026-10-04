import { NextResponse } from "next/server";
import { looksLikeSensitiveConsultPayload, sanitizeConsultEvent } from "@/lib/consult-call";
import { allowConsultEvent, appendConsultEvent } from "@/lib/consult-events-store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (looksLikeSensitiveConsultPayload(body)) {
    return NextResponse.json({ error: "Evento rejeitado." }, { status: 400 });
  }
  const clean = sanitizeConsultEvent(body);
  if (!clean) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }
  if (!allowConsultEvent(clean.roomId)) {
    return NextResponse.json({ ok: true, limited: true });
  }
  await appendConsultEvent(clean);
  return NextResponse.json({ ok: true });
}
