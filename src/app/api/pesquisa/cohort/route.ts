import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { applyFilters, buildCohortRecords, describe, type Filter } from "@/lib/research";

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { filters?: Filter[]; anonymize?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const filters = Array.isArray(body.filters) ? body.filters : [];
  const anonymize = body.anonymize !== false; // padrão: anonimizado

  const all = await buildCohortRecords(doctorId);
  const matched = applyFilters(all, filters);
  const stats = describe(matched);

  // Códigos de pesquisa estáveis (MR-000001…) e remoção de identificadores no modo anônimo.
  const patients = matched.map((r, i) => {
    const code = `MR-${String(i + 1).padStart(6, "0")}`;
    const { __id, __name, ...vars } = r;
    if (anonymize) {
      return { codigo: code, ...vars };
    }
    return { codigo: code, id: __id, nome: __name, ...vars };
  });

  return NextResponse.json({ count: matched.length, total: all.length, stats, patients, anonymize });
}
