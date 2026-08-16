import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy } from "@/lib/research-studies-store";
import { buildCohortRecords, applyFilters } from "@/lib/research";
import { completeness, describeVars, resultsText } from "@/lib/research-analysis";
import { RESEARCH_VARS_BY_KEY } from "@/lib/research-fields";

const DEFAULT_VARS = [
  "idade", "sexo", "drc", "estagio_g", "categoria_a", "has", "dm",
  "lab_creatinina", "lab_tfge", "lab_rac",
];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });

  const all = await buildCohortRecords(doctorId);
  const matched = applyFilters(all, study.filters);
  const variables = study.variables.length ? study.variables : DEFAULT_VARS;

  const table1 = describeVars(matched, variables);
  const quality = completeness(matched, variables);
  const results = resultsText(study.question, matched.length, all.length, table1);

  // Banco científico ANONIMIZADO (P0001…) apenas com as variáveis selecionadas.
  const patients = matched.map((r, i) => {
    const code = `P${String(i + 1).padStart(4, "0")}`;
    const row: Record<string, unknown> = { codigo: code };
    for (const k of variables) {
      const def = RESEARCH_VARS_BY_KEY.get(k);
      const raw = r[k];
      row[k] = raw ?? (def?.type === "num" ? null : "desconhecido");
    }
    return row;
  });

  return NextResponse.json({
    study,
    n: matched.length,
    total: all.length,
    variables,
    table1,
    quality,
    results,
    patients,
  });
}
