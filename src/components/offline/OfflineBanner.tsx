"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useOfflineOptional } from "./OfflineProvider";
import { resolveConflictKeepLocal, resolveConflictKeepServer } from "@/lib/offline/sync";

function pillClass(status: string) {
  if (status === "offline") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "syncing") return "bg-sky-50 text-sky-800 border-sky-200";
  if (status === "pending-error") return "bg-red-50 text-red-800 border-red-200";
  if (status === "synced") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  return "bg-emerald-50 text-emerald-800 border-emerald-200";
}

function label(status: string) {
  if (status === "offline") return "🟠 Modo offline";
  if (status === "syncing") return "🔄 Sincronizando…";
  if (status === "pending-error") return "⚠️ Pendências";
  if (status === "synced") return "🟢 Sincronizado";
  return "🟢 Online — Sincronizado";
}

/** Indicador discreto. Só aparece nas áreas logadas (médico em consulta). */
export function OfflineBanner() {
  const ctx = useOfflineOptional();
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  if (!ctx) return null;
  const inChart = pathname.startsWith("/medicos/paciente");
  const inApp = pathname.startsWith("/medicos") || pathname.startsWith("/paciente") || pathname.startsWith("/consulta");
  if (!inApp) return null;
  if (!inChart && ctx.status === "online" && ctx.pending.length === 0 && !ctx.lastSyncMsg) return null;

  const pending = ctx.pending;
  const conflicts = pending.filter((p) => p.status === "conflict");

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex max-w-[min(92vw,360px)] flex-col items-end gap-2">
      <button
        type="button"
        className={`pointer-events-auto rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm ${pillClass(ctx.status)}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label(ctx.status)}
        {pending.length > 0 ? ` · ${pending.length}` : ""}
      </button>
      {ctx.status === "offline" && (
        <p className="pointer-events-auto rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[12px] leading-snug text-amber-900 shadow-sm">
          Você está sem conexão. Suas alterações estão sendo salvas neste dispositivo e serão sincronizadas quando a internet retornar.
        </p>
      )}
      {ctx.status === "synced" && ctx.lastSyncMsg && (
        <p className="pointer-events-auto rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800 shadow-sm">
          {ctx.lastSyncMsg}
        </p>
      )}
      {ctx.status === "pending-error" && (
        <div className="pointer-events-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 shadow-sm">
          <p className="font-semibold">⚠️ Existem alterações ainda não sincronizadas.</p>
          <button type="button" className="mt-1 font-bold underline" onClick={() => ctx.retry()}>
            Tentar novamente
          </button>
        </div>
      )}
      {open && pending.length > 0 && (
        <div className="pointer-events-auto w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-left shadow-lg">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
            Alterações pendentes: {pending.length}
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--text-soft)]">
            {pending.map((p) => (
              <li key={p.id} className="rounded-lg bg-[var(--bg)] px-2 py-1.5">
                <span className="font-semibold text-[var(--text)]">{p.label}</span>
                {p.status === "error" && p.error && <p className="text-[11px] text-[var(--danger)]">{p.error}</p>}
                {p.status === "conflict" && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button type="button" className="btn-gold px-2 py-0.5 text-[11px]" onClick={async () => { await resolveConflictKeepLocal(p.id); await ctx.retry(); }}>
                      Manter este dispositivo
                    </button>
                    <button type="button" className="btn-ghost px-2 py-0.5 text-[11px]" onClick={async () => { await resolveConflictKeepServer(p.id); await ctx.refreshQueue(); }}>
                      Usar versão do servidor
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {ctx.status === "pending-error" && (
            <button type="button" className="btn-gold mt-2 w-full text-sm" onClick={() => ctx.retry()}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {conflicts.length > 0 && !open && (
        <p className="pointer-events-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 shadow-sm">
          O mesmo prontuário foi modificado em outro dispositivo. Abra as pendências para escolher o que manter.
        </p>
      )}
    </div>
  );
}

export function OfflineNeedsNet({ children, label }: { children: React.ReactNode; label?: string }) {
  const ctx = useOfflineOptional();
  if (ctx && !ctx.online) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {label || "Esta função precisa de conexão com a internet."}
      </p>
    );
  }
  return <>{children}</>;
}
