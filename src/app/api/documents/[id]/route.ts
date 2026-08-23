import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { deleteDocument, getDocumentById } from "@/lib/patient-store";
import { DOCPDF_BUCKET, deleteFile } from "@/lib/doc-storage";

// Exclui um documento (receita/relatório/etc.) do médico dono. Remove também o PDF.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await getDocumentById(id);
  if (!doc || doc.doctorId !== doctorId) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  if (doc.pdfPath) {
    await deleteFile(DOCPDF_BUCKET, (doc.pdfStorage as "supabase" | "local") || "local", doc.pdfPath).catch(() => {});
  }
  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
