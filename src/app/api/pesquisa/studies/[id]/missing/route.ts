import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy } from "@/lib/research-studies-store";
import { buildCohortRecords, applyFilters, type CohortRecord } from "@/lib/research";
import { RESEARCH_VARS_BY_KEY } from "@/lib/research-fields";

const DEFAULT_VARS = [
  "idade", "sexo", "drc", "estagio_g", "categoria_a", "has", "dm",
  "lab_creatinina", "lab_tfge", "lab_rac",
];

/** Onde corrigir cada variável no prontuário do paciente. */
function fixTab(key: string): "exames" | "perfil" | "cadastro" {
  if (key.startsWith("lab_")) return "exames";
  if (key === "sexo" || key === "idade" || key === "cidade") return "cadastro";
  return "perfil";
}

/** Uma variável está "faltando" (mesma regra da completude). */
function isMissing(rec: CohortRecord, key: string): boolean {
  const def = RESEARCH_VARS_BY_KEY.get(key);
  const type = def?.type || "cat";
  const raw = rec[key];
  if (type === "num") return !(raw !== null && raw !== undefined && Number.isFinite(Number(raw)));
  return !(raw !== null && raw !== undefined && String(raw) !== "" && String(raw) !== "desconhecido");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });

  const all = await buildCohortRecords(doctorId);
  const matched = applyFilters(all, study.filters);
  const variables = study.variables.length ? study.variables : DEFAULT_VARS;

  // Faltantes por variável (contagem) + lista de pacientes por variável.
  const byVariable = variables.map((key) => {
    const def = RESEARCH_VARS_BY_KEY.get(key);
    const patients = matched
      .filter((r) => isMissing(r, key))
      .map((r) => ({ id: r.__id, name: r.__name }));
    return { key, label: def?.label || key, type: def?.type || "cat", fixTab: fixTab(key), missing: patients.length, patients };
  });

  // Faltantes por paciente (para clicar e corrigir).
  const byPatient = matched
    .map((r) => ({
      id: r.__id,
      name: r.__name,
      missing: variables
        .filter((k) => isMissing(r, k))
        .map((k) => ({ key: k, label: RESEARCH_VARS_BY_KEY.get(k)?.label || k, fixTab: fixTab(k) })),
      // sexo atual (para o ajuste rápido)
      sexo: (r.sexo as string) || "desconhecido",
    }))
    .filter((p) => p.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length);

  return NextResponse.json({ total: matched.length, variables: byVariable, patients: byPatient });
}
