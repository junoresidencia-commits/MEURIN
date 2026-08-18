import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { encryptSecret, decryptSecret } from "./crypto-secrets";
import { SITE_URL } from "./site";
import { WHATSAPP_NUMBER } from "./contact";

export type WhatsAppMode = "api" | "wame";

export interface WhatsAppSettings {
  mode: WhatsAppMode;
  phoneDisplay: string; // número oficial exibido
  businessAccount?: string;
  wabaId?: string;
  phoneNumberId?: string;
  accessTokenEnc?: string; // criptografado
  appSecretEnc?: string; // criptografado
  verifyToken?: string;
  templateName?: string;
  inviteMessage?: string; // usa {nome} e {site}
  permMedico: boolean;
  permAtendente: boolean;
  permNutricionista: boolean;
  permOutros: boolean;
}

export interface WhatsAppMessageLog {
  id: string;
  senderRole?: string | null;
  senderName?: string | null;
  recipient?: string | null;
  recipientPhone?: string | null;
  method: "api" | "wame";
  status: string; // enviado | entregue | lido | falhou | assistido
  detail?: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "whatsapp.json");
const LOG_FILE = path.join(DATA_DIR, "whatsapp-log.json");
const ROW_ID = "whatsapp";
let settingsTableMissing = false;
let logTableMissing = false;

function active() { return Boolean(getSupabaseAdmin()); }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

export const DEFAULT_INVITE_MESSAGE =
  "Olá, {nome}! Seu acesso ao Meu Rim já está disponível.\n\n" +
  "Acesse pelo celular ou computador:\n{site}/\n\n" +
  "No primeiro acesso, o sistema pedirá para você criar uma senha pessoal.\n\n" +
  "Pelo Meu Rim, você acompanha consultas, exames, medicamentos, documentos e a evolução da sua saúde renal.";

function defaults(): WhatsAppSettings {
  return {
    mode: "wame",
    phoneDisplay: "+55 73 99905-2933",
    inviteMessage: DEFAULT_INVITE_MESSAGE,
    permMedico: true, permAtendente: true, permNutricionista: true, permOutros: false,
  };
}

// ---------- Settings ----------
export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  if (active() && !settingsTableMissing) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("platform_settings").select("data").eq("id", ROW_ID).maybeSingle();
    if (!error) return { ...defaults(), ...((data?.data as Partial<WhatsAppSettings>) ?? {}) };
    if (isMissing(error)) settingsTableMissing = true;
  }
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    return { ...defaults(), ...(JSON.parse(raw) as Partial<WhatsAppSettings>) };
  } catch {
    return defaults();
  }
}

export async function saveWhatsAppSettings(patch: Partial<WhatsAppSettings> & { accessToken?: string | null; appSecret?: string | null }): Promise<void> {
  const current = await getWhatsAppSettings();
  const next: WhatsAppSettings = { ...current };
  // Campos não-secretos
  const keys: (keyof WhatsAppSettings)[] = ["mode", "phoneDisplay", "businessAccount", "wabaId", "phoneNumberId", "verifyToken", "templateName", "inviteMessage", "permMedico", "permAtendente", "permNutricionista", "permOutros"];
  for (const k of keys) {
    if (patch[k] !== undefined) (next as unknown as Record<string, unknown>)[k] = patch[k];
  }
  // Segredos: só atualiza quando um novo valor não-vazio é enviado; "" limpa.
  if (patch.accessToken !== undefined) next.accessTokenEnc = patch.accessToken ? encryptSecret(patch.accessToken) : "";
  if (patch.appSecret !== undefined) next.appSecretEnc = patch.appSecret ? encryptSecret(patch.appSecret) : "";

  if (active() && !settingsTableMissing) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("platform_settings").upsert({ id: ROW_ID, data: next, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (!error) return;
    if (isMissing(error)) settingsTableMissing = true;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf8");
}

/** Projeção pública (sem segredos) para o frontend. */
export function publicSettings(s: WhatsAppSettings) {
  const configured = Boolean(s.phoneNumberId && s.accessTokenEnc);
  return {
    mode: s.mode,
    phoneDisplay: s.phoneDisplay,
    businessAccount: s.businessAccount || "",
    wabaId: s.wabaId || "",
    phoneNumberId: s.phoneNumberId || "",
    verifyToken: s.verifyToken || "",
    templateName: s.templateName || "",
    inviteMessage: s.inviteMessage || DEFAULT_INVITE_MESSAGE,
    permMedico: s.permMedico, permAtendente: s.permAtendente, permNutricionista: s.permNutricionista, permOutros: s.permOutros,
    hasAccessToken: Boolean(s.accessTokenEnc),
    hasAppSecret: Boolean(s.appSecretEnc),
    status: configured ? (s.mode === "api" ? "conectado" : "pronto (wa.me)") : "desconectado",
    webhookUrl: `${SITE_URL}/api/whatsapp/webhook`,
    officialNumber: WHATSAPP_NUMBER,
  };
}

// ---------- Message log ----------
export async function logWhatsAppMessage(input: Omit<WhatsAppMessageLog, "id" | "createdAt">): Promise<WhatsAppMessageLog> {
  const row: WhatsAppMessageLog = { id: uuid(), createdAt: new Date().toISOString(), ...input };
  if (active() && !logTableMissing) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("whatsapp_messages").insert({
      id: row.id, sender_role: row.senderRole, sender_name: row.senderName, recipient: row.recipient,
      recipient_phone: row.recipientPhone, method: row.method, status: row.status, detail: row.detail, created_at: row.createdAt,
    });
    if (!error) return row;
    if (isMissing(error)) logTableMissing = true;
  }
  try {
    const raw = await fs.readFile(LOG_FILE, "utf8").catch(() => "[]");
    const list = JSON.parse(raw) as WhatsAppMessageLog[];
    list.push(row);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LOG_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch { /* ignore */ }
  return row;
}

export async function listWhatsAppMessages(limit = 50): Promise<WhatsAppMessageLog[]> {
  if (active() && !logTableMissing) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(limit);
    if (!error) return (data ?? []).map((r) => ({
      id: String(r.id), senderRole: (r.sender_role as string) ?? null, senderName: (r.sender_name as string) ?? null,
      recipient: (r.recipient as string) ?? null, recipientPhone: (r.recipient_phone as string) ?? null,
      method: (r.method as "api" | "wame") ?? "wame", status: String(r.status ?? ""), detail: (r.detail as string) ?? null,
      createdAt: String(r.created_at ?? new Date().toISOString()),
    }));
    if (isMissing(error)) logTableMissing = true;
  }
  try {
    const raw = await fs.readFile(LOG_FILE, "utf8").catch(() => "[]");
    return (JSON.parse(raw) as WhatsAppMessageLog[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  } catch { return []; }
}

// ---------- Send ----------
function waMeLink(phone: string, text: string): string {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^(?!55)/, "55");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export interface SendResult { ok: boolean; method: "api" | "wame"; status: string; url?: string; detail?: string }

/** Envia (API oficial quando configurada) ou devolve o link wa.me (envio assistido). */
export async function sendWhatsApp(toPhone: string, text: string): Promise<SendResult> {
  const s = await getWhatsAppSettings();
  const token = decryptSecret(s.accessTokenEnc);
  const canApi = s.mode === "api" && Boolean(s.phoneNumberId) && Boolean(token);
  if (!canApi) {
    return { ok: true, method: "wame", status: "assistido", url: waMeLink(toPhone, text) };
  }
  try {
    const to = String(toPhone || "").replace(/\D/g, "").replace(/^(?!55)/, "55");
    const res = await fetch(`https://graph.facebook.com/v20.0/${s.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, method: "api", status: "falhou", detail: data?.error?.message || `HTTP ${res.status}`, url: waMeLink(toPhone, text) };
    }
    return { ok: true, method: "api", status: "enviado", detail: data?.messages?.[0]?.id || "" };
  } catch (err) {
    return { ok: false, method: "api", status: "falhou", detail: err instanceof Error ? err.message : "erro", url: waMeLink(toPhone, text) };
  }
}

/** Testa a conexão com a Meta (Graph API) usando o token salvo. */
export async function testWhatsAppConnection(): Promise<{ ok: boolean; detail: string }> {
  const s = await getWhatsAppSettings();
  const token = decryptSecret(s.accessTokenEnc);
  if (!s.phoneNumberId || !token) return { ok: false, detail: "Configure o Phone Number ID e o token de acesso." };
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${s.phoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, detail: data?.error?.message || `HTTP ${res.status}` };
    return { ok: true, detail: `Conectado: ${data.display_phone_number || ""} ${data.verified_name ? "(" + data.verified_name + ")" : ""}`.trim() };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "erro" };
  }
}
