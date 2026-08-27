"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { listQueue, loadSession, saveSession, wipeDoctorData } from "@/lib/offline/idb";
import { syncPending } from "@/lib/offline/sync";
import type { ConnectionUi, OfflineOp, OfflineSession } from "@/lib/offline/types";

type Ctx = {
  online: boolean;
  status: ConnectionUi;
  session: OfflineSession | null;
  pending: OfflineOp[];
  lastSyncMsg: string;
  retry: () => Promise<void>;
  refreshQueue: () => Promise<void>;
};

const OfflineCtx = createContext<Ctx | null>(null);

export function useOffline() {
  const c = useContext(OfflineCtx);
  if (!c) throw new Error("useOffline precisa do OfflineProvider");
  return c;
}

export function useOfflineOptional(): Ctx | null {
  return useContext(OfflineCtx);
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState<ConnectionUi>("online");
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [pending, setPending] = useState<OfflineOp[]>([]);
  const [lastSyncMsg, setLastSyncMsg] = useState("");
  const syncedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshQueue = useCallback(async () => {
    const s = session || (await loadSession());
    if (!s) { setPending([]); return; }
    setPending(await listQueue(s.doctorId));
  }, [session]);

  const runSync = useCallback(async () => {
    const s = session || (await loadSession());
    if (!s || !navigator.onLine) return;
    const ops = await listQueue(s.doctorId);
    if (ops.length === 0) {
      setStatus("synced");
      setLastSyncMsg("✓ Tudo sincronizado");
      if (syncedTimer.current) clearTimeout(syncedTimer.current);
      syncedTimer.current = setTimeout(() => setStatus("online"), 2500);
      return;
    }
    setStatus("syncing");
    setLastSyncMsg("Sincronizando…");
    const r = await syncPending(s.doctorId);
    await refreshQueue();
    if (r.conflicts > 0 || r.errors > 0) {
      setStatus("pending-error");
      setLastSyncMsg("⚠️ Existem alterações ainda não sincronizadas.");
    } else {
      setStatus("synced");
      setLastSyncMsg(r.synced > 0 ? `✓ ${r.synced} alteração(ões) sincronizada(s)` : "✓ Tudo sincronizado");
      if (syncedTimer.current) clearTimeout(syncedTimer.current);
      syncedTimer.current = setTimeout(() => setStatus("online"), 3500);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("meurim:offline-synced", { detail: r }));
    }
  }, [session, refreshQueue]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setStatus(navigator.onLine ? "online" : "offline");
    const on = () => { setOnline(true); void runSync(); };
    const off = () => { setOnline(false); setStatus("offline"); setLastSyncMsg(""); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [runSync]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth");
        const d = res.ok ? await res.json() : null;
        const doc = d?.doctor;
        const prev = await loadSession();
        if (doc?.id) {
          if (prev && prev.doctorId !== doc.id) await wipeDoctorData(prev.doctorId);
          const next: OfflineSession = { doctorId: doc.id, doctorName: doc.name || "Médico", cachedAt: new Date().toISOString() };
          await saveSession(next);
          if (!cancelled) setSession(next);
        } else {
          if (prev && navigator.onLine) {
            // Online e sem sessão: limpa (logout em outra aba).
            await wipeDoctorData(prev.doctorId);
            if (!cancelled) setSession(null);
          } else if (prev) {
            if (!cancelled) setSession(prev);
          }
        }
      } catch {
        const prev = await loadSession();
        if (!cancelled && prev) setSession(prev);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (session && online) void runSync();
  }, [session, online, runSync]);

  const retry = useCallback(async () => {
    await runSync();
  }, [runSync]);

  const value = useMemo<Ctx>(
    () => ({ online, status, session, pending, lastSyncMsg, retry, refreshQueue }),
    [online, status, session, pending, lastSyncMsg, retry, refreshQueue]
  );

  return <OfflineCtx.Provider value={value}>{children}</OfflineCtx.Provider>;
}
