import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { FIRST_VISIT_STUDY_ID } from "@/lib/first-visit";
import {
  buildFirstVisitRecords,
  firstVisitStats,
  matchesFirstVisitFilters,
  anonymizeFirstVisit,
  type FirstVisitFilters,
} from "@/lib/first-visit-research";
import { exportGate } from "@/lib/research-governance-store";

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const filters: FirstVisitFilters = {
    from: url.searchParams.get("from") || null,
    to: url.searchParams.get("to") || null,
    municipio: url.searchParams.get("municipio") || null,
    idadeMin: num(url.searchParams.get("idadeMin")),
    idadeMax: num(url.searchParams.get("idadeMax")),
    diagnostico: url.searchParams.get("diagnostico") || null,
    certeza: (url.searchParams.get("certeza") as FirstVisitFilters["certeza"]) || null,
    drc: url.searchParams.get("drc") || null,
  };
  const anonymize = url.searchParams.get("anonymize") !== "0";

  const all = await buildFirstVisitRecords(doctorId);
  const matched = all.filter((r) => matchesFirstVisitFilters(r, filters));
  const stats = firstVisitStats(matched, all.length);
  const gate = await exportGate(FIRST_VISIT_STUDY_ID, doctorId, "coorte_retro");

  const flat = anonymizeFirstVisit(matched);
  const patients = matched.map((r, i) => ({
    ...flat[i],
    ...(anonymize ? {} : { id: r.patientId, nome: r.name }),
    exames: r.exames,
    certaintyReason: r.certaintyReason,
  }));

  return NextResponse.json({
    total: all.length,
    n: matched.length,
    stats,
    patients,
    anonymize,
    export: gate,
  });
}
