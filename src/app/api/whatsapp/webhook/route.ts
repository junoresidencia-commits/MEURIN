import { NextResponse } from "next/server";
import { getWhatsAppSettings } from "@/lib/whatsapp-store";

// Verificação do webhook da Meta (GET) e recebimento de eventos (POST).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const s = await getWhatsAppSettings();
  if (mode === "subscribe" && token && s.verifyToken && token === s.verifyToken) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  // Recebe status de entrega/leitura. Apenas confirma o recebimento (200) para a Meta.
  try { await req.json().catch(() => ({})); } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}
