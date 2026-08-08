import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { clientIp, currentDocuments, parseUserAgent } from "@/lib/consent";
import { addAudit, ensureDocumentsPublished, recordAcceptance } from "@/lib/consent-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json();
  const sessionEmail = await getPatientEmail();
  // Identidade = sessão do paciente (pode ser e-mail OU "pid:<id>" para conta por CPF).
  // No fluxo de agendamento (sem sessão), exige e-mail válido informado.
  const email = String(sessionEmail || body.email || "").toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Identificação do paciente ausente." }, { status: 400 });
  }
  if (!sessionEmail && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  const accepted = (body.accepted || {}) as Record<string, boolean>;
  const client = (body.client || {}) as {
    language?: string;
    screenResolution?: string;
    sessionId?: string;
  };

  const ip = clientIp(req.headers);
  const ua = req.headers.get("user-agent") || "";
  const { browser, operatingSystem, device } = parseUserAgent(ua);

  const docs = currentDocuments();
  const ids = await ensureDocumentsPublished();

  const toRecord = docs.filter((d) => accepted[d.type] === true);
  if (toRecord.length === 0) {
    return NextResponse.json({ error: "Nenhum consentimento marcado." }, { status: 400 });
  }

  const acceptedAt = new Date().toISOString(); // hora do servidor
  const recorded: string[] = [];

  for (const d of toRecord) {
    const rec = await recordAcceptance({
      patientId: sessionEmail || null,
      patientEmail: email,
      patientCpf: body.cpf ? String(body.cpf) : null,
      consentType: d.type,
      consentVersion: d.version,
      documentId: ids.get(d.type) || null,
      documentSha256: d.sha256,
      accepted: true,
      acceptedAt,
      ipAddress: ip || null,
      userAgent: ua || null,
      browser,
      operatingSystem,
      device,
      language: client.language ? String(client.language) : null,
      screenResolution: client.screenResolution ? String(client.screenResolution) : null,
      sessionId: client.sessionId ? String(client.sessionId) : null,
    });
    recorded.push(rec.id);
    await addAudit({
      patientEmail: email,
      action: `consent_accept:${d.type}`,
      tableName: "consent_acceptances",
      recordId: rec.id,
      ipAddress: ip || null,
    });
  }

  return NextResponse.json({ ok: true, recorded }, { status: 201 });
}
