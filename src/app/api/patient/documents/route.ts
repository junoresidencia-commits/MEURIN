import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getDocuments } from "@/lib/patient-store";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  const documents = await getDocuments(email, { onlyShared: true });
  return NextResponse.json({ documents });
}
