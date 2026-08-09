import "server-only";
import webpush from "web-push";
import { insertNotification, listDevices, removeDevice } from "./notifications-store";
import type { NotifyRole } from "./types";

/* Camada ÚNICA de notificações do Meu Rim.
   - registra a notificação in-app (central + histórico);
   - dispara Web Push para os dispositivos do usuário (best-effort);
   - preparada para, no futuro, também acionar push nativo (iOS/Android) pelo mesmo ponto.
   PRIVACIDADE: title/body NUNCA devem conter dado clínico. Os chamadores enviam textos discretos. */

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@meurim.app";
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    vapidReady = true;
    return true;
  } catch {
    return false;
  }
}

export interface NotifyInput {
  userId: string; // médico id OU chave do paciente (e-mail minúsculo / pid:<id>)
  role: NotifyRole;
  type: string;
  title: string;
  body?: string;
  targetUrl?: string;
  tag?: string; // agrupa/atualiza push da mesma consulta
  relatedType?: string;
  relatedId?: string;
  data?: Record<string, unknown>;
}

/** Ponto único: grava a notificação e envia push. Nunca lança para não quebrar o fluxo principal. */
export async function sendNotification(input: NotifyInput): Promise<void> {
  const userId = (input.userId || "").trim();
  if (!userId) return;
  let sentAt: string | null = null;

  // 1) Web Push (best-effort)
  try {
    if (ensureVapid()) {
      const devices = await listDevices(userId);
      if (devices.length > 0) {
        const payload = JSON.stringify({
          title: input.title,
          body: input.body || "Você recebeu uma atualização no Meu Rim.",
          url: input.targetUrl || "/",
          tag: input.tag,
          data: { type: input.type, ...(input.data || {}) },
        });
        const results = await Promise.allSettled(
          devices.map((d) => webpush.sendNotification(d.subscription as unknown as webpush.PushSubscription, payload))
        );
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === "rejected") {
            const code = (r.reason as { statusCode?: number })?.statusCode;
            if (code === 404 || code === 410) {
              // Assinatura expirada/revogada → limpa.
              await removeDevice(devices[i].endpoint).catch(() => {});
            }
          } else {
            sentAt = new Date().toISOString();
          }
        }
      }
    }
  } catch {
    // engole erros de push — a notificação in-app abaixo ainda é registrada
  }

  // 2) Notificação in-app (sempre)
  try {
    await insertNotification({
      userId,
      role: input.role,
      type: input.type,
      title: input.title,
      message: input.body,
      targetUrl: input.targetUrl,
      relatedEntityType: input.relatedType,
      relatedEntityId: input.relatedId,
      sentAt,
    });
  } catch {
    // não quebrar o fluxo de negócio por causa de notificação
  }
}

/** Chave de notificação do paciente a partir do e-mail informado na consulta. */
export function patientKey(email?: string | null): string {
  return (email || "").toLowerCase().trim();
}

/** Data/hora amigável no fuso indicado (padrão America/Bahia). Ex.: "18/08 às 14:00". */
export function fmtDateTime(iso: string, tz = "America/Bahia"): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(",", " às");
  } catch {
    return new Date(iso).toLocaleString("pt-BR");
  }
}

/** Só o horário (HH:mm) no fuso. */
export function fmtTime(iso: string, tz = "America/Bahia"): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  } catch {
    return new Date(iso).toLocaleTimeString("pt-BR");
  }
}

/** Primeiro nome (para notificação do médico, sem expor nome completo). */
export function firstName(full?: string | null): string {
  return (full || "").trim().split(/\s+/)[0] || "Paciente";
}

/** Deep links internos (as páginas já existem e listam a consulta). */
export const links = {
  doctorConsulta: (id: string) => `/medicos/agenda?consulta=${id}`,
  patientConsulta: (id: string) => `/minhas-consultas?consulta=${id}`,
  patientRoom: (id: string) => `/minhas-consultas?consulta=${id}`,
};
