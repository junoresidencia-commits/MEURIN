import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { saveDevice } from "@/lib/notifications-store";
import type { PushSubscriptionJSONish } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const subscription = body?.subscription as PushSubscriptionJSONish | undefined;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
    }
    const platform = (body?.platform as "web" | "ios" | "android") || "web";
    const deviceName = typeof body?.deviceName === "string" ? body.deviceName : undefined;

    const device = await saveDevice({ userId: user.userId, role: user.role, platform, subscription, deviceName });
    return NextResponse.json({ ok: true, id: device.id });
  } catch (err) {
    console.error("push/subscribe", err);
    return NextResponse.json({ error: "Não foi possível ativar as notificações agora." }, { status: 500 });
  }
}
