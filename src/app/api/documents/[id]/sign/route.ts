import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getDoctorSessionId } from "@/lib/auth";
import { getDocumentById, signDocument } from "@/lib/patient-store";
import { DOCPDF_BUCKET, readFile } from "@/lib/doc-storage";

/** Assinatura ELETRÔNICA (vinculada ao acesso do médico) — NÃO é assinatura digital
 *  com certificado ICP-Brasil. Registra autor, data/hora e hash do PDF; após assinar,
 *  a versão fica imutável (novas alterações devem gerar nova versão/documento). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await getDocumentById(id);
  if (!doc || doc.doctorId !== doctorId) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  if (doc.status === "signed") return NextResponse.json({ ok: true, alreadySigned: true });
  if (!doc.pdfPath) return NextResponse.json({ error: "Documento sem PDF para assinar." }, { status: 400 });

  const file = await readFile(DOCPDF_BUCKET, (doc.pdfStorage as "supabase" | "local") || "supabase", doc.pdfPath);
  if (!file) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
  const hash = createHash("sha256").update(file.buffer).digest("hex");

  const updated = await signDocument(id, { by: doc.doctorName, method: "eletronica", hash });
  return NextResponse.json({ ok: true, document: updated, signatureHash: hash });
}
