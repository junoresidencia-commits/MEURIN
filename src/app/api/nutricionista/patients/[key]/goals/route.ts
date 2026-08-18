import { NextResponse } from "next/server";
import { requireNutritionist, resolveNutritionPatientAccess } from "@/lib/nutrition-context";
import { getNutritionLink } from "@/lib/nutritionists-store";
import { getGoals, setGoals, type NutritionTargets } from "@/lib/nutrition-diary-store";

function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const access = await resolveNutritionPatientAccess(decodeURIComponent(key));
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const goals = await getGoals(access.key);
  return NextResponse.json({ goals });
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { key } = await params;
  const access = await resolveNutritionPatientAccess(decodeURIComponent(key));
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const link = await getNutritionLink(nut.id, access.doctorId);
  if (link && !link.permissions.criarPlano) {
    return NextResponse.json({ error: "Você não tem permissão para definir metas para os pacientes deste médico." }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const t = (b.targets && typeof b.targets === "object") ? b.targets : {};
  const targets: NutritionTargets = {
    kcal: num(t.kcal), protein_g: num(t.protein_g), sodium_mg: num(t.sodium_mg),
    potassium_mg: num(t.potassium_mg), phosphorus_mg: num(t.phosphorus_mg), liquids_ml: num(t.liquids_ml),
  };
  const goals = await setGoals(access.key, {
    nutritionistId: nut.id, nutritionistName: nut.name, targets, note: b.note ? String(b.note) : null,
  });
  return NextResponse.json({ ok: true, goals });
}
