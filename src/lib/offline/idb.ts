/** IndexedDB do modo offline. Isolado por médico. Nunca usa localStorage para dados clínicos. */

import {
  OFFLINE_DB,
  OFFLINE_DB_VERSION,
  SNAPSHOT_TTL_MS,
  MAX_SNAPSHOTS,
  type ChartSnapshot,
  type OfflineDraft,
  type OfflineOp,
  type OfflineSession,
} from "./types";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível."));
      return;
    }
    const req = indexedDB.open(OFFLINE_DB, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("session")) db.createObjectStore("session");
      if (!db.objectStoreNames.contains("snapshots")) {
        const s = db.createObjectStore("snapshots", { keyPath: "key" });
        s.createIndex("doctorId", "doctorId", { unique: false });
      }
      if (!db.objectStoreNames.contains("drafts")) {
        const d = db.createObjectStore("drafts", { keyPath: "key" });
        d.createIndex("doctorId", "doctorId", { unique: false });
      }
      if (!db.objectStoreNames.contains("queue")) {
        const q = db.createObjectStore("queue", { keyPath: "id" });
        q.createIndex("doctorId", "doctorId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Falha ao abrir IndexedDB."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqTo<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function snapshotKey(doctorId: string, patientKey: string): string {
  return `${doctorId}::${decodeURIComponent(patientKey)}`;
}

export function draftKey(doctorId: string, patientKey: string, kind: OfflineDraft["kind"]): string {
  return `${doctorId}::${decodeURIComponent(patientKey)}::${kind}`;
}

export async function saveSession(s: OfflineSession): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("session", "readwrite");
  tx.objectStore("session").put(s, "current");
  await txDone(tx);
}

export async function loadSession(): Promise<OfflineSession | null> {
  try {
    const db = await openDb();
    const tx = db.transaction("session", "readonly");
    const v = await reqTo(tx.objectStore("session").get("current"));
    return (v as OfflineSession) || null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snap: ChartSnapshot): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("snapshots", "readwrite");
  const store = tx.objectStore("snapshots");
  store.put(snap);
  const idx = store.index("doctorId");
  const all = await reqTo(idx.getAll(snap.doctorId)) as ChartSnapshot[];
  const sorted = [...all].sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
  for (const extra of sorted.slice(MAX_SNAPSHOTS)) store.delete(extra.key);
  await txDone(tx);
}

export async function getSnapshot(doctorId: string, patientKey: string): Promise<ChartSnapshot | null> {
  const db = await openDb();
  const tx = db.transaction("snapshots", "readonly");
  const snap = (await reqTo(tx.objectStore("snapshots").get(snapshotKey(doctorId, patientKey)))) as ChartSnapshot | undefined;
  if (!snap) return null;
  if (new Date(snap.expiresAt).getTime() < Date.now()) {
    await deleteSnapshot(snap.key);
    return null;
  }
  return snap;
}

export async function listSnapshots(doctorId: string): Promise<ChartSnapshot[]> {
  const db = await openDb();
  const tx = db.transaction("snapshots", "readonly");
  const all = (await reqTo(tx.objectStore("snapshots").index("doctorId").getAll(doctorId))) as ChartSnapshot[];
  const now = Date.now();
  return all.filter((s) => new Date(s.expiresAt).getTime() >= now);
}

async function deleteSnapshot(key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("snapshots", "readwrite");
  tx.objectStore("snapshots").delete(key);
  await txDone(tx);
}

export async function saveDraft(d: OfflineDraft): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("drafts", "readwrite");
  tx.objectStore("drafts").put(d);
  await txDone(tx);
}

export async function getDraft(doctorId: string, patientKey: string, kind: OfflineDraft["kind"]): Promise<OfflineDraft | null> {
  const db = await openDb();
  const tx = db.transaction("drafts", "readonly");
  const v = await reqTo(tx.objectStore("drafts").get(draftKey(doctorId, patientKey, kind)));
  return (v as OfflineDraft) || null;
}

export async function deleteDraft(doctorId: string, patientKey: string, kind: OfflineDraft["kind"]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("drafts", "readwrite");
  tx.objectStore("drafts").delete(draftKey(doctorId, patientKey, kind));
  await txDone(tx);
}

export async function enqueue(op: OfflineOp): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  const existing = await reqTo(tx.objectStore("queue").get(op.id));
  if (existing) {
    await txDone(tx);
    return; // idempotente: não duplica a mesma operação
  }
  tx.objectStore("queue").put(op);
  await txDone(tx);
}

export async function getOp(id: string): Promise<OfflineOp | null> {
  const db = await openDb();
  const tx = db.transaction("queue", "readonly");
  const v = await reqTo(tx.objectStore("queue").get(id));
  return (v as OfflineOp) || null;
}

export async function listQueue(doctorId: string): Promise<OfflineOp[]> {
  const db = await openDb();
  const tx = db.transaction("queue", "readonly");
  const all = (await reqTo(tx.objectStore("queue").index("doctorId").getAll(doctorId))) as OfflineOp[];
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateOp(id: string, patch: Partial<OfflineOp>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  const cur = (await reqTo(tx.objectStore("queue").get(id))) as OfflineOp | undefined;
  if (!cur) {
    await txDone(tx);
    return;
  }
  tx.objectStore("queue").put({ ...cur, ...patch });
  await txDone(tx);
}

export async function removeOp(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  tx.objectStore("queue").delete(id);
  await txDone(tx);
}

/** Apaga dados clínicos do médico no dispositivo (logout / troca de conta). */
export async function wipeDoctorData(doctorId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["snapshots", "drafts", "queue", "session"], "readwrite");
  const snaps = (await reqTo(tx.objectStore("snapshots").index("doctorId").getAll(doctorId))) as ChartSnapshot[];
  for (const s of snaps) tx.objectStore("snapshots").delete(s.key);
  const drafts = (await reqTo(tx.objectStore("drafts").index("doctorId").getAll(doctorId))) as OfflineDraft[];
  for (const d of drafts) tx.objectStore("drafts").delete(d.key);
  const ops = (await reqTo(tx.objectStore("queue").index("doctorId").getAll(doctorId))) as OfflineOp[];
  for (const o of ops) tx.objectStore("queue").delete(o.id);
  const sess = (await reqTo(tx.objectStore("session").get("current"))) as OfflineSession | undefined;
  if (sess?.doctorId === doctorId) tx.objectStore("session").delete("current");
  await txDone(tx);
}

export async function wipeAllOffline(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["snapshots", "drafts", "queue", "session"], "readwrite");
  tx.objectStore("snapshots").clear();
  tx.objectStore("drafts").clear();
  tx.objectStore("queue").clear();
  tx.objectStore("session").clear();
  await txDone(tx);
}

export function newClientOpId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function snapshotExpiry(from = Date.now()): string {
  return new Date(from + SNAPSHOT_TTL_MS).toISOString();
}

/** Limpa dados clínicos locais no logout (não espera a próxima checagem de sessão). */
export async function wipeOfflineOnLogout(): Promise<void> {
  try {
    const sess = await loadSession();
    if (sess) await wipeDoctorData(sess.doctorId);
    else await wipeAllOffline();
  } catch {
    /* IndexedDB pode estar indisponível; o logout do servidor segue. */
  }
}
