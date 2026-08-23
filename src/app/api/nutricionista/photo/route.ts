import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/nutrition-context";
import { updateNutritionistSettings } from "@/lib/nutritionists-store";

const MAX_CHARS = 700_000;
const ALLOWED = ["data:image/png", "data:image/jpeg", "data:image/jpg", "data:image/webp"];

export async function GET() {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json({ photoUrl: nut.photoUrl ?? null });
}

export async function POST(req: Request) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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
  await updateNutritionistSettings(nut.id, { photoUrl: photo });
  return NextResponse.json({ ok: true, photoUrl: photo });
}

export async function DELETE() {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await updateNutritionistSettings(nut.id, { photoUrl: null });
  return NextResponse.json({ ok: true });
}
