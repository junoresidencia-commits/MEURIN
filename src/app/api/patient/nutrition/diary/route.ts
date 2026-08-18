import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { addDiaryEntry, deleteDiaryEntry, getGoals, listDiary, type DiaryNutrients } from "@/lib/nutrition-diary-store";
import { getFood, nutrientsForGrams } from "@/lib/foods-br";
import { computeDailyTotals, trafficLight, topContributors, educationalMessage } from "@/lib/nutrition-tracking";
import { getLabResults } from "@/lib/patient-store";
import { getProfile } from "@/lib/clinical-profile-store";
import { computeAttention } from "@/lib/nutrition-attention";

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
}

export async function GET(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") || today();
  const [entries, goals, labs, profile] = await Promise.all([listDiary(email, date), getGoals(email), getLabResults(email), getProfile(email)]);
  const totals = computeDailyTotals(entries);
  const tracks = trafficLight(totals, goals?.targets);
  const attention = computeAttention(labs.map((l) => ({ testKey: l.testKey, value: l.value, measuredAt: l.measuredAt })), profile?.data as Record<string, unknown> | undefined);
  // Alertas educativos + principais contribuintes por nutriente em atenção/acima.
  const alerts = tracks
    .filter((t) => t.status === "amarelo" || t.status === "vermelho")
    .map((t) => {
      const nutrientKey = t.key === "liquids_ml" ? null : (t.key as keyof DiaryNutrients);
      return {
        key: t.key, status: t.status, label: t.label,
        message: educationalMessage(t),
        contributors: nutrientKey ? topContributors(entries, nutrientKey, 3) : [],
      };
    });
  return NextResponse.json({ date, entries, totals, tracks, goals, alerts, attention, hasGoals: Boolean(goals && Object.values(goals.targets).some((v) => typeof v === "number" && v > 0)) });
}

export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  try {
    const b = await req.json().catch(() => ({}));
    const kind = b.kind === "liquido" ? "liquido" : "alimento";
    const date = b.date && /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : today();

    let food = String(b.food || "").trim();
    let grams: number | null = b.grams != null && b.grams !== "" ? Number(b.grams) : null;
    const volumeMl: number | null = b.volumeMl != null && b.volumeMl !== "" ? Number(b.volumeMl) : null;
    let household: string | null = b.household ? String(b.household) : null;
    let nutrients: DiaryNutrients = {};

    if (kind === "alimento") {
      // Se veio um foodId do banco, calcula os nutrientes pela porção.
      const f = b.foodId ? getFood(String(b.foodId)) : undefined;
      if (f) {
        if (!food) food = f.name + (f.state ? ` (${f.state})` : "");
        const g = grams && grams > 0 ? grams : (f.measureGrams || 100);
        grams = g;
        if (!household) household = f.measure || null;
        const n = nutrientsForGrams(f, g);
        nutrients = { kcal: n.kcal, protein_g: n.protein_g, carb_g: n.carb_g, fat_g: n.fat_g, sodium_mg: n.sodium_mg, potassium_mg: n.potassium_mg, phosphorus_mg: n.phosphorus_mg };
      } else if (b.nutrients && typeof b.nutrients === "object") {
        nutrients = b.nutrients as DiaryNutrients;
      }
      if (!food) return NextResponse.json({ error: "Informe o alimento." }, { status: 400 });
    } else {
      if (!food) food = "Líquido";
      if (!volumeMl || volumeMl <= 0) return NextResponse.json({ error: "Informe a quantidade em mL." }, { status: 400 });
    }

    const photoUrl = typeof b.photoUrl === "string" && b.photoUrl.startsWith("data:") && b.photoUrl.length < 900000 ? b.photoUrl : null;

    const entry = await addDiaryEntry({
      patientKey: email, date, kind, meal: b.meal ? String(b.meal) : null, timeLabel: b.timeLabel ? String(b.timeLabel) : null,
      food, grams, volumeMl, household, nutrients, note: b.note ? String(b.note) : null, photoUrl,
    });
    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (err) {
    console.error("patient/nutrition/diary", err);
    return NextResponse.json({ error: "Não foi possível registrar agora." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  await deleteDiaryEntry(id, email);
  return NextResponse.json({ ok: true });
}
