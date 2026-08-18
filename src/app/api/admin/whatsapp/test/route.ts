import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { logWhatsAppMessage, sendWhatsApp, testWhatsAppConnection } from "@/lib/whatsapp-store";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "connection");

  if (action === "connection") {
    const r = await testWhatsAppConnection();
    return NextResponse.json(r);
  }

  if (action === "message") {
    const to = String(b.to || "").trim();
    const message = String(b.message || "").trim() || "Mensagem de teste do Meu Rim ✅";
    if (!to) return NextResponse.json({ ok: false, detail: "Informe o número de destino." }, { status: 400 });
    const r = await sendWhatsApp(to, message);
    await logWhatsAppMessage({
      senderRole: "admin", senderName: "Administrador", recipient: "Teste", recipientPhone: to,
      method: r.method, status: r.status, detail: r.detail || (r.url ? "link wa.me gerado" : ""),
    });
    return NextResponse.json(r);
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
