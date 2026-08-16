import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy } from "@/lib/research-studies-store";
import { buildCohortRecords, applyFilters } from "@/lib/research";
import { compareGroups } from "@/lib/research-compare";
import { RESEARCH_VARS_BY_KEY } from "@/lib/research-fields";

const DEFAULT_VARS = ["idade", "sexo", "drc", "estagio_g", "categoria_a", "has", "dm", "lab_creatinina", "lab_tfge", "lab_rac"];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });

  const all = await buildCohortRecords(doctorId);
  const matched = applyFilters(all, study.filters);
  const variables = study.variables.length ? study.variables : DEFAULT_VARS;

  // Opções de agrupamento: variáveis categóricas com ≥ 2 valores observados.
  const options: { key: string; label: string; values: string[] }[] = [];
  for (const key of variables) {
    const def = RESEARCH_VARS_BY_KEY.get(key);
    if (!def || def.type !== "cat") continue;
    const vals = new Set<string>();
    for (const r of matched) { const v = String(r[key] ?? "desconhecido"); if (v !== "desconhecido") vals.add(v); }
    if (vals.size >= 2) options.push({ key, label: def.label, values: Array.from(vals).sort() });
  }

  const url = new URL(req.url);
  const groupVar = url.searchParams.get("groupVar") || "";
  const a = url.searchParams.get("a") || "";
  const b = url.searchParams.get("b") || "";

  let result = null;
  if (groupVar && a && b && a !== b) {
    result = compareGroups(matched, groupVar, a, b, variables);
  }

  return NextResponse.json({ n: matched.length, variables, options, result });
}
