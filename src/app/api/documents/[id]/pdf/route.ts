import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getPatientEmail } from "@/lib/patient-session";
import { getNutritionistId } from "@/lib/nutrition-session";
import { getDocumentById, markPatientViewed } from "@/lib/patient-store";
import { DOCPDF_BUCKET, readFile } from "@/lib/doc-storage";

/** Serve o PDF final com verificação de permissão (nunca URL pública permanente). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const doc = await getDocumentById(id);
  if (!doc || !doc.pdfPath) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

  const doctorId = await getDoctorSessionId();
  const patientEmail = await getPatientEmail();
  const nutritionistId = await getNutritionistId();
  const isOwnerDoctor = doctorId && doctorId === doc.doctorId;
  // Nutricionista autora do documento (documentos de nutrição usam doctorId = id da nutricionista).
  const isAuthorNutritionist = nutritionistId && nutritionistId === doc.doctorId;
  const isPatientAllowed = patientEmail && patientEmail.toLowerCase() === doc.patientEmail.toLowerCase() && doc.sharedWithPatient;
  if (!isOwnerDoctor && !isAuthorNutritionist && !isPatientAllowed) {
    return NextResponse.json({ error: "Sem acesso a este documento." }, { status: 403 });
  }

  const file = await readFile(DOCPDF_BUCKET, (doc.pdfStorage as "supabase" | "local") || "supabase", doc.pdfPath);
  if (!file) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });

  if (isPatientAllowed) markPatientViewed(id).catch(() => {});

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${(doc.type || "documento")}-meurim.pdf"`,
    },
  });
}
