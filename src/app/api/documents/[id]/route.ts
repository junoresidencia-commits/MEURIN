import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { deleteDocument, getDocumentById } from "@/lib/patient-store";
import { DOCPDF_BUCKET, deleteFile } from "@/lib/doc-storage";

// Exclui rascunho/não assinado. Documento médico já assinado permanece (CANCELLED/SUPERSEDED, não DELETE).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await getDocumentById(id);
  if (!doc || doc.doctorId !== doctorId) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  if (doc.status === "signed") {
    return NextResponse.json(
      {
        error:
          "Documento assinado não pode ser apagado. O histórico permanece no prontuário. Se precisar corrigir, gere uma nova versão.",
      },
      { status: 409 },
    );
  }
  if (doc.pdfPath) {
    await deleteFile(DOCPDF_BUCKET, (doc.pdfStorage as "supabase" | "local") || "local", doc.pdfPath).catch(() => {});
  }
  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
