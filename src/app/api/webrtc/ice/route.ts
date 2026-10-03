import { NextResponse } from "next/server";
import { getIceServers } from "@/lib/ice-servers";

export async function GET() {
  try {
    const { iceServers, turn } = await getIceServers();
    return NextResponse.json({ iceServers, turn });
  } catch (err) {
    console.error("[webrtc/ice]", err);
    return NextResponse.json({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      turn: false,
    });
  }
}
