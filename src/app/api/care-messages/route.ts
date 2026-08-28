import { NextResponse } from "next/server";
import { firstName, sendNotification } from "@/lib/notify";
import { addCareMessage, listCareMessages, markCareMessagesRead } from "@/lib/care-messages-store";
import { careRoleLabel, professionalChatUrl, resolveCareThread, notifyRoleForCare } from "@/lib/care-messages-access";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const thread = await resolveCareThread({
    role: url.searchParams.get("role") || "",
    professionalId: url.searchParams.get("professionalId") || undefined,
    patientKey: url.searchParams.get("patientKey") || undefined,
  });
  if (!thread) return NextResponse.json({ error: "Sem acesso a esta conversa." }, { status: 403 });
  const messages = await listCareMessages(thread.role, thread.professionalId, thread.patientKey);
  await markCareMessagesRead(thread.role, thread.professionalId, thread.patientKey, thread.sender);
  return NextResponse.json({ messages, thread: { role: thread.role, professionalId: thread.professionalId, patientKey: thread.patientKey, sender: thread.sender } });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const body = String(b.body || "").trim();
  if (!body) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });
  if (body.length > 2000) return NextResponse.json({ error: "Mensagem muito longa (máx. 2000 caracteres)." }, { status: 400 });

  const thread = await resolveCareThread({
    role: String(b.role || ""),
    professionalId: b.professionalId ? String(b.professionalId) : undefined,
    patientKey: b.patientKey ? String(b.patientKey) : undefined,
  });
  if (!thread) return NextResponse.json({ error: "Sem acesso a esta conversa." }, { status: 403 });

  const msg = await addCareMessage({
    role: thread.role,
    professionalId: thread.professionalId,
    patientKey: thread.patientKey,
    sender: thread.sender,
    body,
  });

  try {
    const label = careRoleLabel(thread.role);
    if (thread.sender === "patient") {
      await sendNotification({
        userId: thread.professionalId,
        role: notifyRoleForCare(thread.role),
        type: "care_message",
        title: "Nova mensagem de um paciente",
        body: `${firstName(thread.patientName)} enviou uma mensagem.`,
        targetUrl: professionalChatUrl(thread.role, thread.patientKey),
        relatedType: "care_message",
        relatedId: msg.id,
      });
    } else {
      await sendNotification({
        userId: thread.patientNotifyId,
        role: "paciente",
        type: "care_message",
        title: "Nova mensagem da sua equipe",
        body: `Seu(sua) ${label} respondeu.`,
        targetUrl: "/paciente/inicio#equipe",
        relatedType: "care_message",
        relatedId: msg.id,
      });
    }
  } catch { /* notificação não bloqueia a mensagem */ }

  return NextResponse.json({ ok: true, message: msg }, { status: 201 });
}
