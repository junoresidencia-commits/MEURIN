import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { listNotifications, markAllRead, markRead, unreadCount } from "@/lib/notifications-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifications: [], unread: 0, authenticated: false });
  const [notifications, unread] = await Promise.all([
    listNotifications(user.userId, 50),
    unreadCount(user.userId),
  ]);
  return NextResponse.json({ notifications, unread, authenticated: true });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  if (action === "read_all") {
    await markAllRead(user.userId);
    return NextResponse.json({ ok: true });
  }
  if (action === "read" && body?.id) {
    await markRead(user.userId, String(body.id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
