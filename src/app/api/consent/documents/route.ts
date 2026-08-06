import { NextResponse } from "next/server";
import { currentDocuments } from "@/lib/consent";
import { ensureDocumentsPublished } from "@/lib/consent-store";

export async function GET() {
  // Garante que as versões atuais estejam registradas (para auditoria) e as devolve.
  await ensureDocumentsPublished();
  return NextResponse.json({ documents: currentDocuments() });
}
