import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron dos lembretes (24h/2h). Protegido por CRON_SECRET.
 *  A Vercel Cron envia o header "Authorization: Bearer <CRON_SECRET>" automaticamente.
 *  Também aceita ?key=<CRON_SECRET> para acionamento manual/externo. */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem segredo definido, não bloqueia (dev). Configure em produção.
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("key") === secret) return true;
  if (req.headers.get("x-vercel-cron")) return true; // acionado pela própria Vercel
  return false;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = await runReminderSweep();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    console.error("cron/reminders", err);
    return NextResponse.json({ error: "Falha ao processar lembretes." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
