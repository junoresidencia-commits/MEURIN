import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/nutrition-context";
import { searchFoods } from "@/lib/foods-br";

export async function GET(req: Request) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") || "";
  return NextResponse.json({ foods: searchFoods(q, 20) });
}
