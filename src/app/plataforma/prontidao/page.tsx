"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string; ok: boolean; critical: boolean; detail?: string };

export default function ProntidaoPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/plataforma/saude")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setReady(Boolean(d.readiness?.ready));
        setBlocked(d.readiness?.blocked || []);
        setItems(d.readiness?.items || []);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Prontidão para clínica real</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Se um item crítico falhar, o sistema <b>não</b> deve ser marcado como pronto.
      </p>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {ready !== null && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${ready ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {ready
            ? "Itens críticos medidos pelo app estão ok. Ainda confira isolamento e restore no staging."
            : `Ainda não está pronto: ${blocked.join(" · ")}`}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {items.map((i) => (
          <div key={i.id} className="panel flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-bold">{i.ok ? "✅" : "❌"} {i.label}</p>
              {i.detail && <p className="text-sm text-[var(--text-muted)]">{i.detail}</p>}
            </div>
            {i.critical && <p className="text-xs font-semibold uppercase text-[var(--gold)]">Crítico</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
