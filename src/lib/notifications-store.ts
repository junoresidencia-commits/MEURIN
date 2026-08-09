import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import type { AppNotification, NotifyRole, PushDevice, PushSubscriptionJSONish } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DEVICES_FILE = path.join(DATA_DIR, "user-devices.json");
const NOTIFS_FILE = path.join(DATA_DIR, "notifications.json");

let devicesTableMissing = false;
let notifsTableMissing = false;

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
function devicesActive() {
  return Boolean(getSupabaseAdmin()) && !devicesTableMissing;
}
function notifsActive() {
  return Boolean(getSupabaseAdmin()) && !notifsTableMissing;
}

// ---------- local helpers ----------
async function readLocal<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T[];
  } catch {
    return [];
  }
}
async function writeLocal<T>(file: string, list: T[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(list, null, 2), "utf8");
}

// ---------- mapping ----------
function mapDeviceRow(r: Record<string, unknown>): PushDevice {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    role: (r.role as NotifyRole) ?? "paciente",
    platform: (r.platform as PushDevice["platform"]) ?? "web",
    endpoint: String(r.endpoint),
    subscription: r.subscription as PushSubscriptionJSONish,
    deviceName: (r.device_name as string) ?? undefined,
    enabled: r.enabled !== false,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
    lastUsedAt: (r.last_used_at as string) ?? undefined,
  };
}
function mapNotifRow(r: Record<string, unknown>): AppNotification {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    role: (r.role as NotifyRole) ?? "paciente",
    type: String(r.type),
    title: String(r.title),
    message: (r.message as string) ?? undefined,
    targetUrl: (r.target_url as string) ?? undefined,
    relatedEntityType: (r.related_entity_type as string) ?? undefined,
    relatedEntityId: (r.related_entity_id as string) ?? undefined,
    readAt: (r.read_at as string) ?? null,
    sentAt: (r.sent_at as string) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

// ========================= DEVICES =========================

/** Cria/atualiza (upsert por endpoint) uma assinatura de push do usuário. */
export async function saveDevice(input: {
  userId: string;
  role: NotifyRole;
  platform?: PushDevice["platform"];
  subscription: PushSubscriptionJSONish;
  deviceName?: string;
}): Promise<PushDevice> {
  const now = new Date().toISOString();
  const endpoint = input.subscription.endpoint;
  const device: PushDevice = {
    id: uuid(),
    userId: input.userId,
    role: input.role,
    platform: input.platform ?? "web",
    endpoint,
    subscription: input.subscription,
    deviceName: input.deviceName,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  };
  if (devicesActive()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("user_devices")
      .upsert(
        {
          user_id: device.userId,
          role: device.role,
          platform: device.platform,
          endpoint: device.endpoint,
          subscription: device.subscription,
          device_name: device.deviceName ?? null,
          enabled: true,
          updated_at: now,
          last_used_at: now,
        },
        { onConflict: "endpoint" }
      )
      .select()
      .maybeSingle();
    if (!isMissing(error)) {
      if (error) throw error;
      return data ? mapDeviceRow(data) : device;
    }
    devicesTableMissing = true;
  }
  const list = await readLocal<PushDevice>(DEVICES_FILE);
  const idx = list.findIndex((d) => d.endpoint === endpoint);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...device, id: list[idx].id, createdAt: list[idx].createdAt };
  } else {
    list.push(device);
  }
  await writeLocal(DEVICES_FILE, list);
  return device;
}

/** Remove um dispositivo pelo endpoint (unsubscribe). */
export async function removeDevice(endpoint: string): Promise<void> {
  if (devicesActive()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("user_devices").delete().eq("endpoint", endpoint);
    if (!isMissing(error)) {
      if (error) throw error;
      return;
    }
    devicesTableMissing = true;
  }
  const list = await readLocal<PushDevice>(DEVICES_FILE);
  await writeLocal(DEVICES_FILE, list.filter((d) => d.endpoint !== endpoint));
}

/** Lista dispositivos ativos de um usuário. */
export async function listDevices(userId: string): Promise<PushDevice[]> {
  if (devicesActive()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("user_devices").select("*").eq("user_id", userId).eq("enabled", true);
    if (!isMissing(error) && !error) return (data ?? []).map(mapDeviceRow);
    if (isMissing(error)) devicesTableMissing = true;
  }
  const list = await readLocal<PushDevice>(DEVICES_FILE);
  return list.filter((d) => d.userId === userId && d.enabled);
}

// ========================= NOTIFICATIONS =========================

/** Insere uma notificação in-app (histórico + central). */
export async function insertNotification(n: {
  userId: string;
  role: NotifyRole;
  type: string;
  title: string;
  message?: string;
  targetUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  sentAt?: string | null;
}): Promise<AppNotification> {
  const now = new Date().toISOString();
  const notif: AppNotification = {
    id: uuid(),
    userId: n.userId,
    role: n.role,
    type: n.type,
    title: n.title,
    message: n.message,
    targetUrl: n.targetUrl,
    relatedEntityType: n.relatedEntityType,
    relatedEntityId: n.relatedEntityId,
    readAt: null,
    sentAt: n.sentAt ?? null,
    createdAt: now,
  };
  if (notifsActive()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        id: notif.id,
        user_id: notif.userId,
        role: notif.role,
        type: notif.type,
        title: notif.title,
        message: notif.message ?? null,
        target_url: notif.targetUrl ?? null,
        related_entity_type: notif.relatedEntityType ?? null,
        related_entity_id: notif.relatedEntityId ?? null,
        sent_at: notif.sentAt ?? null,
        created_at: now,
      })
      .select()
      .maybeSingle();
    if (!isMissing(error)) {
      if (error) throw error;
      return data ? mapNotifRow(data) : notif;
    }
    notifsTableMissing = true;
  }
  const list = await readLocal<AppNotification>(NOTIFS_FILE);
  list.push(notif);
  await writeLocal(NOTIFS_FILE, list);
  return notif;
}

/** Lista notificações do usuário (mais recentes primeiro). */
export async function listNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  if (notifsActive()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!isMissing(error) && !error) return (data ?? []).map(mapNotifRow);
    if (isMissing(error)) notifsTableMissing = true;
  }
  const list = await readLocal<AppNotification>(NOTIFS_FILE);
  return list
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function unreadCount(userId: string): Promise<number> {
  if (notifsActive()) {
    const supabase = getSupabaseAdmin()!;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (!isMissing(error) && !error) return count ?? 0;
    if (isMissing(error)) notifsTableMissing = true;
  }
  const list = await readLocal<AppNotification>(NOTIFS_FILE);
  return list.filter((n) => n.userId === userId && !n.readAt).length;
}

export async function markRead(userId: string, id: string): Promise<void> {
  const now = new Date().toISOString();
  if (notifsActive()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("notifications").update({ read_at: now }).eq("id", id).eq("user_id", userId);
    if (!isMissing(error)) {
      if (error) throw error;
      return;
    }
    notifsTableMissing = true;
  }
  const list = await readLocal<AppNotification>(NOTIFS_FILE);
  await writeLocal(NOTIFS_FILE, list.map((n) => (n.id === id && n.userId === userId ? { ...n, readAt: now } : n)));
}

export async function markAllRead(userId: string): Promise<void> {
  const now = new Date().toISOString();
  if (notifsActive()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
    if (!isMissing(error)) {
      if (error) throw error;
      return;
    }
    notifsTableMissing = true;
  }
  const list = await readLocal<AppNotification>(NOTIFS_FILE);
  await writeLocal(NOTIFS_FILE, list.map((n) => (n.userId === userId && !n.readAt ? { ...n, readAt: now } : n)));
}
