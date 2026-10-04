import { NextResponse } from "next/server";
import { requireAllied } from "@/lib/allied-access";
import { updateAlliedSettings } from "@/lib/allied-store";

const MAX_CHARS = 700_000;
const ALLOWED = ["data:image/png", "data:image/jpeg", "data:image/jpg", "data:image/webp"];

export async function GET() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json({ photoUrl: pro.photoUrl ?? null });
}

export async function POST(req: Request) {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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
  await updateAlliedSettings(pro.id, { photoUrl: photo });
  return NextResponse.json({ ok: true, photoUrl: photo });
}

export async function DELETE() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await updateAlliedSettings(pro.id, { photoUrl: null });
  return NextResponse.json({ ok: true });
}
