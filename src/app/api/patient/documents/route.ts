import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getDocuments } from "@/lib/patient-store";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  const docs = await getDocuments(email, { onlyShared: true });
  // Nunca expõe caminhos de storage. PDF gerado é servido pelo proxy autenticado.
  const documents = docs.map((d) => ({
    id: d.id,
    type: d.type,
    title: d.title,
    body: d.pdfPath ? "" : d.body, // se tem PDF, o corpo é o próprio PDF
    doctorName: d.doctorName,
    createdAt: d.createdAt,
    status: d.status ?? "final",
    signed: d.status === "signed",
    pdfUrl: d.pdfPath ? `/api/documents/${d.id}/pdf` : null,
    viewUrl: d.pdfPath ? `/api/documents/${d.id}/pdf` : `/documento/${d.id}`,
  }));
  return NextResponse.json({ documents });
}
