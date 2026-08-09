"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/lib/types";

export default function NotificacoesPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" });
    const j = await r.json();
    setItems(j.notifications || []);
    setAuthenticated(Boolean(j.authenticated));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openItem(n: AppNotification) {
    if (!n.readAt) {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", id: n.id }),
      }).catch(() => {});
    }
    if (n.targetUrl) router.push(n.targetUrl);
    else load();
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    }).catch(() => {});
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Notificações</h1>
        {items.some((n) => !n.readAt) && (
          <button type="button" className="btn-ghost text-sm" onClick={markAll}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {authenticated === false && (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-6 text-center">
          <p className="text-[var(--text-muted)]">Entre para ver suas notificações.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/paciente/entrar" className="btn-gold">Sou paciente</Link>
            <Link href="/medicos/login" className="btn-ghost">Sou médico</Link>
          </div>
        </div>
      )}

      {authenticated && (
        <div className="mt-6 grid gap-2">
          {items.length === 0 && (
            <p className="rounded-2xl border border-[var(--border)] bg-white px-4 py-10 text-center text-[var(--text-muted)]">
              Nenhuma notificação por aqui ainda.
            </p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openItem(n)}
              className={`flex flex-col items-start gap-1 rounded-2xl border border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--bg-soft)] ${
                n.readAt ? "bg-white" : "bg-[var(--gold-soft)]"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-semibold text-[var(--text)]">{n.title}</span>
                {!n.readAt && <span className="h-2 w-2 rounded-full bg-[var(--gold)]" />}
              </div>
              {n.message && <span className="text-sm text-[var(--text-soft)]">{n.message}</span>}
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(n.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
