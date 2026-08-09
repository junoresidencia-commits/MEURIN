"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Sino de notificações com contador, lista, marcar como lida e deep-link.
 *  Atualiza o badge do ícone do app quando suportado (navigator.setAppBadge). */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [authenticated, setAuthenticated] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      const j = await r.json();
      setItems(j.notifications || []);
      setUnread(j.unread || 0);
      setAuthenticated(Boolean(j.authenticated));
      // Badge no ícone do app (PWA), quando suportado.
      const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (j.unread > 0) nav.setAppBadge?.(j.unread).catch(() => {});
      else nav.clearAppBadge?.().catch(() => {});
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    }).catch(() => {});
    load();
  }

  async function openItem(n: AppNotification) {
    if (!n.readAt) {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", id: n.id }),
      }).catch(() => {});
    }
    setOpen(false);
    load();
    if (n.targetUrl) router.push(n.targetUrl);
  }

  if (!authenticated) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--text)] transition hover:bg-[var(--gold-soft)]"
      >
        <span aria-hidden className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--danger)] px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[92vw] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <p className="font-bold text-[var(--text)]">Notificações</p>
            {unread > 0 && (
              <button type="button" className="text-xs font-semibold text-[var(--gold)]" onClick={markAll}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Nenhuma notificação por aqui ainda.</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--bg-soft)] ${
                  n.readAt ? "" : "bg-[var(--gold-soft)]"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--text)]">{n.title}</span>
                  {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" />}
                </div>
                {n.message && <span className="text-sm text-[var(--text-soft)]">{n.message}</span>}
                <span className="text-xs text-[var(--text-muted)]">{timeAgo(n.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
