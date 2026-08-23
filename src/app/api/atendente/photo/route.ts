import { NextResponse } from "next/server";
import { getAttendantId } from "@/lib/attendant-session";
import { getAttendant, setAttendantPhoto } from "@/lib/attendants-store";

const MAX_CHARS = 700_000;
const ALLOWED = ["data:image/png", "data:image/jpeg", "data:image/jpg", "data:image/webp"];

export async function GET() {
  const id = await getAttendantId();
  if (!id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const att = await getAttendant(id);
  if (!att) return NextResponse.json({ error: "Atendente não encontrado." }, { status: 404 });
  return NextResponse.json({ photoUrl: att.photoUrl ?? null });
}

export async function POST(req: Request) {
  const id = await getAttendantId();
  if (!id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: { photo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const photo = typeof body.photo === "string" ? body.photo.trim() : "";
  if (!photo || !ALLOWED.some((p) => photo.startsWith(p))) {
    return NextResponse.json({ error: "Envie uma imagem PNG, JPG ou WEBP." }, { status: 400 });
  }
  if (photo.length > MAX_CHARS) {
    return NextResponse.json({ error: "Imagem muito grande. Use uma foto menor (até ~500 KB)." }, { status: 413 });
  }
  await setAttendantPhoto(id, photo);
  return NextResponse.json({ ok: true, photoUrl: photo });
}

export async function DELETE() {
  const id = await getAttendantId();
  if (!id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await setAttendantPhoto(id, null);
  return NextResponse.json({ ok: true });
}
