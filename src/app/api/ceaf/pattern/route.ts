import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getPattern, savePattern, type DocBox } from "@/lib/ceaf-patterns-store";

export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const docKey = new URL(req.url).searchParams.get("docKey") || "";
  if (!docKey) return NextResponse.json({ error: "docKey obrigatório." }, { status: 400 });
  const boxes = await getPattern(doctorId, docKey);
  return NextResponse.json({ boxes: boxes ?? null });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const docKey = String(body.docKey || "");
  const boxes = Array.isArray(body.boxes) ? (body.boxes as DocBox[]) : [];
  if (!docKey) return NextResponse.json({ error: "docKey obrigatório." }, { status: 400 });
  await savePattern(doctorId, docKey, boxes);
  return NextResponse.json({ ok: true });
}
