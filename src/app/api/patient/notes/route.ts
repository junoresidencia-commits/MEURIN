import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getClinicalNotes } from "@/lib/patient-store";

export async function GET() {
  const email = await getPatientEmail();
  if (!email) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }
  const notes = await getClinicalNotes(email, { onlyShared: true });
  return NextResponse.json({ notes });
}
