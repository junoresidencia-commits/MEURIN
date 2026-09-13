import { NextResponse } from "next/server";
import { getPlatformActor } from "@/lib/platform-access";

export async function GET() {
  const actor = await getPlatformActor();
  if (!actor) return NextResponse.json({ actor: null }, { status: 401 });
  return NextResponse.json({ actor });
}
