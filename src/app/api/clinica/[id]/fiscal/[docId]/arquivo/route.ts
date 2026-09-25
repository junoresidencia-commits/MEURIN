import { NextResponse } from "next/server";
import { requireClinicCashPerm } from "@/lib/platform-access";
import { getFiscalDoc } from "@/lib/clinic-cash-store";
import { CLINIC_CASH_BUCKET, readFile } from "@/lib/doc-storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const staff = await requireClinicCashPerm(id, "finance_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const doc = await getFiscalDoc(docId);
  if (!doc || doc.clinicId !== id) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
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
