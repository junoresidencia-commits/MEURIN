import { NextResponse } from "next/server";

/** Expõe a chave pública VAPID para o cliente assinar o push. A privada NUNCA sai do servidor. */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  return NextResponse.json({ publicKey, configured: Boolean(publicKey && process.env.VAPID_PRIVATE_KEY) });
}
