import { NextResponse } from "next/server";
import { findOpenCourtesy } from "@/lib/courtesy-credits-store";
import { courtesyLabel, normalizeCourtesyKey } from "@/lib/courtesy";

/** Paciente consulta se o médico já liberou retorno/consulta grátis. Só devolve o essencial. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const doctorId = String(url.searchParams.get("doctorId") || "").trim();
  const email = normalizeCourtesyKey(url.searchParams.get("email"));
  if (!doctorId || !email || !email.includes("@")) {
    return NextResponse.json({ hasCredit: false });
  }
  const credit = await findOpenCourtesy(doctorId, email);
  if (!credit) return NextResponse.json({ hasCredit: false });
  return NextResponse.json({
    hasCredit: true,
    kind: credit.kind,
    label: courtesyLabel(credit.kind),
  });
}
