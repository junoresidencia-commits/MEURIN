import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";
import { safeLog } from "@/lib/safe-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron dos lembretes. Na Vercel exige CRON_SECRET (já existe no projeto meurim). */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.VERCEL) return false;
    return true;
  }
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("key") === secret) return true;
  return false;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = await runReminderSweep();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    safeLog("cron/reminders", err);
    return NextResponse.json({ error: "Falha ao processar lembretes." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
