import { NextResponse } from "next/server";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getFiscalDoc } from "@/lib/clinic-cash-store";
import { CLINIC_CASH_BUCKET, readFile } from "@/lib/doc-storage";

export async function GET(req: Request, { params }: { params: Promise<{ email: string; docId: string }> }) {
  const { email, docId } = await params;
  const access = await resolvePatientAccess(email);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const doc = await getFiscalDoc(docId);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  const keys = [access.key, access.email].filter(Boolean).map((k) => k.toLowerCase());
  if (!keys.includes(doc.patientKey.toLowerCase())) {
    return NextResponse.json({ error: "Documento de outro paciente." }, { status: 403 });
  }
  const which = new URL(req.url).searchParams.get("kind") === "xml" ? "xml" : "pdf";
  const path = which === "xml" ? doc.xmlPath : doc.pdfPath;
  const storage = which === "xml" ? doc.xmlStorage : doc.pdfStorage;
  if (!path || !storage) return NextResponse.json({ error: "Arquivo ainda não disponível." }, { status: 404 });
  const file = await readFile(CLINIC_CASH_BUCKET, storage, path);
  if (!file) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
  const name = which === "xml" ? doc.xmlName || "nfse.xml" : `${doc.kind}-${doc.number || doc.id.slice(0, 8)}.pdf`;
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": which === "xml" ? "application/xml" : "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
