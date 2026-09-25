import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { catalogPublic, runTool } from "@/lib/calculators";
import { SECTION_LABEL } from "@/lib/calculators/catalog";
import { buildCalcContext } from "@/lib/calculators/context";
import { syncToolCatalog } from "@/lib/calculators-store";
import type { ManualOverrides } from "@/lib/calculators/types";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  syncToolCatalog().catch(() => {});
  return NextResponse.json({
    tools: catalogPublic(),
    sections: SECTION_LABEL,
  });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const toolId = String(body.toolId || "").trim();
  if (!toolId) return NextResponse.json({ error: "Informe a calculadora." }, { status: 400 });
  const overrides = (body.overrides || {}) as ManualOverrides;
  const ctx = buildCalcContext({
    ageYears: typeof overrides.idade === "number" ? overrides.idade : overrides.idade != null ? Number(overrides.idade) : null,
    sex: overrides.sexo != null ? String(overrides.sexo) : null,
    profile: {
      peso_kg: overrides.peso_kg ?? null,
      altura_cm: overrides.altura_cm ?? null,
      hemodialise: overrides.em_trs === true ? "sim" : null,
      dcv: overrides.dcv_conhecida === true ? "sim" : null,
      dm: overrides.diabetes ?? null,
      tabagismo: overrides.tabagismo ?? null,
      medicamentos_em_uso: overrides.medicamentos || "",
    },
    extra: Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)) as Record<string, string | number | boolean | null>,
  });
  const result = runTool(toolId, ctx, overrides);
  return NextResponse.json({ result });
}
