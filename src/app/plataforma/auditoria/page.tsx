"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  actorEmail: string | null;
  action: string;
  entity: string | null;
  detail: string | null;
  createdAt: string;
};

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/plataforma/audit")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setEntries(d.entries || []);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Auditoria</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Ações da plataforma e das clínicas. Sem prontuário, sem senha e sem CPF.
      </p>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {entries && entries.length === 0 && (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Nenhum evento ainda.</p>
      )}
      <div className="mt-4 space-y-2">
        {(entries || []).map((e) => (
          <div key={e.id} className="panel">
            <p className="font-bold">{e.action}</p>
            <p className="text-sm text-[var(--text-soft)]">{e.detail || e.entity || "—"}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {new Date(e.createdAt).toLocaleString("pt-BR")}
              {e.actorEmail ? ` · ${e.actorEmail}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
