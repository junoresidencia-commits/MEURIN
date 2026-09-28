"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { id: string; label: string; ok: boolean; critical: boolean; detail?: string };

export default function ProntidaoPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [stagingUrl, setStagingUrl] = useState("");
  const [isolationOk, setIsolationOk] = useState(false);
  const [backupOk, setBackupOk] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/plataforma/saude");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
    setReady(Boolean(d.readiness?.ready));
    setBlocked(d.readiness?.blocked || []);
    setItems(d.readiness?.items || []);
    const url = d.health?.stagingUrl;
    if (url) setStagingUrl(url);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [load]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/plataforma/prontidao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível gravar.");
      setMsg("Registrado. A lista acima atualiza em seguida.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy("");
    }
  }

  const stagingDone = items.find((i) => i.id === "staging")?.ok;
  const isolationDone = items.find((i) => i.id === "isolation")?.ok;
  const backupDone = items.find((i) => i.id === "backup")?.ok;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Prontidão para clínica real</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Se um item crítico falhar, o sistema <b>não</b> deve ser marcado como pronto.
        Os três itens que faltam (staging, isolamento e restore) são registrados nesta tela — não precisa abrir a Vercel.
      </p>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {msg && <p className="mt-4 text-sm font-semibold text-[var(--gold)]">{msg}</p>}
      {ready !== null && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${ready ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {ready
            ? "Itens críticos medidos pelo app estão ok."
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

      {!stagingDone && (
        <section className="panel mt-6">
          <h2 className="font-display text-lg font-extrabold">1. Staging separado</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Cole a URL do site de <b>teste</b> (projeto Vercel diferente da produção, ex. meurin-stagin).
            Não use meurim.vercel.app.
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">URL do staging</span>
            <input
              className="input-field"
              value={stagingUrl}
              onChange={(e) => setStagingUrl(e.target.value)}
              placeholder="https://meurin-stagin.vercel.app"
            />
          </label>
          <button
            type="button"
            className="btn-gold mt-3"
            disabled={busy === "staging" || !stagingUrl.trim()}
            onClick={() => void post({ stagingUrl }, "staging")}
          >
            {busy === "staging" ? "Salvando…" : "Salvar URL do staging"}
          </button>
        </section>
      )}

      {!isolationDone && (
        <section className="panel mt-4">
          <h2 className="font-display text-lg font-extrabold">2. Isolamento entre clínicas</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            No computador, com as chaves de <b>produção desligadas</b>:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-[var(--gold-soft)] px-3 py-2 text-xs">npm run check:clinic-isolation</pre>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            O teste cria duas clínicas fictícias e confirma que o caixa da A não vê o da B, sem mexer em paciente real.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={isolationOk} onChange={(e) => setIsolationOk(e.target.checked)} />
            <span>Rodei o teste com env de produção desligado e passou (clinic-isolation ok).</span>
          </label>
          <button
            type="button"
            className="btn-gold mt-3"
            disabled={busy === "isolation" || !isolationOk}
            onClick={() => void post({ isolationConfirmed: true }, "isolation")}
          >
            {busy === "isolation" ? "Salvando…" : "Registrar isolamento testado"}
          </button>
        </section>
      )}

      {!backupDone && (
        <section className="panel mt-4">
          <h2 className="font-display text-lg font-extrabold">3. Backup / restore ensaiado</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            No Supabase: Backups → restaurar <b>só no projeto staging</b> (nunca em produção).
            Compare pacientes, evoluções, documentos, exames e consultas. Se algum número clínico cair: pare.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={backupOk} onChange={(e) => setBackupOk(e.target.checked)} />
            <span>
              Restaurei o dump apenas no staging e as contagens clínicas não caíram.
            </span>
          </label>
          <button
            type="button"
            className="btn-gold mt-3"
            disabled={busy === "backup" || !backupOk}
            onClick={() => void post({ backupConfirmed: true }, "backup")}
          >
            {busy === "backup" ? "Salvando…" : "Registrar restore ensaiado"}
          </button>
        </section>
      )}
    </div>
  );
}
