import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { getWhatsAppSettings, publicSettings, saveWhatsAppSettings, type WhatsAppMode } from "@/lib/whatsapp-store";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json(publicSettings(await getWhatsAppSettings()));
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const mode: WhatsAppMode | undefined = b.mode === "api" || b.mode === "wame" ? b.mode : undefined;
  await saveWhatsAppSettings({
    mode,
    phoneDisplay: b.phoneDisplay !== undefined ? String(b.phoneDisplay) : undefined,
    businessAccount: b.businessAccount !== undefined ? String(b.businessAccount) : undefined,
    wabaId: b.wabaId !== undefined ? String(b.wabaId) : undefined,
    phoneNumberId: b.phoneNumberId !== undefined ? String(b.phoneNumberId) : undefined,
    verifyToken: b.verifyToken !== undefined ? String(b.verifyToken) : undefined,
    templateName: b.templateName !== undefined ? String(b.templateName) : undefined,
    inviteMessage: b.inviteMessage !== undefined ? String(b.inviteMessage) : undefined,
    permMedico: b.permMedico !== undefined ? Boolean(b.permMedico) : undefined,
    permAtendente: b.permAtendente !== undefined ? Boolean(b.permAtendente) : undefined,
    permNutricionista: b.permNutricionista !== undefined ? Boolean(b.permNutricionista) : undefined,
    permOutros: b.permOutros !== undefined ? Boolean(b.permOutros) : undefined,
    // Segredos (texto puro só na entrada; salvos criptografados). undefined = não altera.
    accessToken: b.accessToken !== undefined ? String(b.accessToken) : undefined,
    appSecret: b.appSecret !== undefined ? String(b.appSecret) : undefined,
  });
  return NextResponse.json({ ok: true, ...publicSettings(await getWhatsAppSettings()) });
}
