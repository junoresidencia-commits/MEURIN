import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getPlanCheckin, setPlanCheckin } from "@/lib/nutrition-plan-checkins-store";

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
}
function validDate(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today();
}

export async function GET(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const date = validDate(new URL(req.url).searchParams.get("date"));
  const done = await getPlanCheckin(email, date);
  return NextResponse.json({ date, done });
}

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const meal = typeof b.meal === "string" ? b.meal.slice(0, 120) : "";
  if (!meal) return NextResponse.json({ error: "Refeição inválida." }, { status: 400 });
  const date = validDate(b.date);
  const done = await setPlanCheckin(email, date, meal, b.done === true);
  return NextResponse.json({ ok: true, date, done });
}
