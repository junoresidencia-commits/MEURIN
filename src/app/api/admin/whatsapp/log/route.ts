import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { listWhatsAppMessages } from "@/lib/whatsapp-store";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ messages: await listWhatsAppMessages(50) });
}
