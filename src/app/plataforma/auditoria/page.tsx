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
  const [email, setEmail] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load() {
    const q = new URLSearchParams();
    if (email) q.set("email", email);
    if (action) q.set("action", action);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    fetch(`/api/plataforma/audit?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setEntries(d.entries || []);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Auditoria</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Ações da plataforma e das clínicas. Sem prontuário, sem senha e sem CPF.
      </p>
      <form
        className="panel mt-4 grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input className="input-field" placeholder="Usuário (e-mail)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input-field" placeholder="Ação (ex.: pay_closing)" value={action} onChange={(e) => setAction(e.target.value)} />
        <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <button type="submit" className="btn-gold">Filtrar</button>
        <input className="input-field sm:col-span-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </form>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {entries && entries.length === 0 && (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Nenhum evento com esses filtros.</p>
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
