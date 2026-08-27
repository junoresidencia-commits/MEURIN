/** Sincroniza a fila offline. Só remove a operação após confirmação do servidor. */

import { deleteDraft, listQueue, removeOp, updateOp } from "./idb";
import type { OfflineOp } from "./types";

export type SyncResult = {
  synced: number;
  remaining: number;
  conflicts: number;
  errors: number;
};

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function syncOne(op: OfflineOp): Promise<"ok" | "conflict" | "error" | "skip"> {
  if (!isOnline()) return "skip";
  await updateOp(op.id, { status: "syncing", error: null });

  try {
    if (op.kind === "note.create") {
      const res = await fetch(`/api/doctor/patients/${encodeURIComponent(op.patientKey)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...op.payload, clientOpId: op.id }),
      });
      if (res.status === 401) throw new Error("Sessão expirada. Entre novamente para sincronizar.");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Erro ${res.status}`);
      }
      await deleteDraft(op.doctorId, op.patientKey, "evolucao").catch(() => {});
      await removeOp(op.id);
      return "ok";
    }

    if (op.kind === "profile.put") {
      const res = await fetch(`/api/doctor/patients/${encodeURIComponent(op.patientKey)}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: op.payload.data,
          baseUpdatedAt: op.payload.baseUpdatedAt,
          clientOpId: op.id,
          force: op.payload.force === true,
        }),
      });
      if (res.status === 409) {
        const d = await res.json().catch(() => ({}));
        await updateOp(op.id, {
          status: "conflict",
          conflict: { serverUpdatedAt: d.updatedAt ?? null, serverData: d.profile ?? null },
          error: "O prontuário foi alterado em outro dispositivo.",
        });
        return "conflict";
      }
      if (res.status === 401) throw new Error("Sessão expirada. Entre novamente para sincronizar.");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Erro ${res.status}`);
      }
      await removeOp(op.id);
      return "ok";
    }

    if (op.kind === "document.generate") {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...op.payload, clientOpId: op.id, preview: false }),
      });
      if (res.status === 401) throw new Error("Sessão expirada. Entre novamente para sincronizar.");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Erro ${res.status}`);
      }
      const kind = String(op.payload.type || "") === "receita" ? "receita" : String(op.payload.type || "") === "relatorio" ? "relatorio" : "documento";
      await deleteDraft(op.doctorId, op.patientKey, kind).catch(() => {});
      await removeOp(op.id);
      return "ok";
    }

    if (op.kind === "lab.create") {
      const res = await fetch(`/api/doctor/patients/${encodeURIComponent(op.patientKey)}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...op.payload, clientOpId: op.id }),
      });
      if (res.status === 401) throw new Error("Sessão expirada. Entre novamente para sincronizar.");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Erro ${res.status}`);
      }
      await removeOp(op.id);
      return "ok";
    }

    throw new Error("Tipo de operação desconhecido.");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao sincronizar.";
    await updateOp(op.id, { status: "error", error: message, attempts: op.attempts + 1 });
    return "error";
  }
}

let running: Promise<SyncResult> | null = null;

export async function syncPending(doctorId: string): Promise<SyncResult> {
  if (running) return running;
  running = (async () => {
    const result: SyncResult = { synced: 0, remaining: 0, conflicts: 0, errors: 0 };
    if (!isOnline()) {
      result.remaining = (await listQueue(doctorId)).length;
      return result;
    }
    const ops = await listQueue(doctorId);
    for (const op of ops) {
      if (op.status === "conflict" && !op.payload.force) {
        result.conflicts += 1;
        continue;
      }
      const r = await syncOne(op);
      if (r === "ok") result.synced += 1;
      else if (r === "conflict") result.conflicts += 1;
      else if (r === "error") result.errors += 1;
    }
    result.remaining = (await listQueue(doctorId)).length;
    return result;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

export async function resolveConflictKeepLocal(opId: string): Promise<void> {
  const { getOp } = await import("./idb");
  const op = await getOp(opId);
  if (!op) return;
  await updateOp(opId, { payload: { ...op.payload, force: true }, status: "pending", conflict: null, error: null });
}

export async function resolveConflictKeepServer(opId: string): Promise<void> {
  await removeOp(opId);
}
