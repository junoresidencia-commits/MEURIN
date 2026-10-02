"use client";

import { useCallback, useEffect, useState } from "react";
import { COURTESY_KIND_LABEL, courtesyLabel, type CourtesyKind } from "@/lib/courtesy";

type Credit = {
  id: string;
  kind: CourtesyKind;
  status: "open" | "used" | "revoked";
  createdAt: string;
  usedAt?: string | null;
};

export function CourtesyConsultPanel({
  patientKey,
  compact,
}: {
  patientKey: string;
  compact?: boolean;
}) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [kind, setKind] = useState<CourtesyKind>("retorno");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/doctor/courtesy-credits?patientKey=${encodeURIComponent(patientKey)}`);
    const d = await r.json();
    if (r.ok) setCredits(d.credits || []);
  }, [patientKey]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const open = credits.find((c) => c.status === "open");

  async function grant() {
    setBusy("grant");
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/doctor/courtesy-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientKey, kind }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível liberar.");
      setMsg(d.message || "Liberado.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy("");
    }
  }

  async function revoke(id: string) {
    setBusy("revoke");
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/doctor/courtesy-credits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível remover.");
      setMsg("Liberação cancelada. O paciente volta a pagar a consulta.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Retorno ou consulta grátis</p>
      <p className="text-sm text-[var(--text-muted)]">
        Você escolhe. Libera para este paciente agendar online sem pagar — retorno depois de uma consulta presencial, ou uma consulta grátis.
      </p>
      {open && (
        <p className="rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm font-semibold text-[var(--gold)]">
          {courtesyLabel(open.kind)} liberado — o paciente agenda em /agendar sem cobrança.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(["retorno", "gratis"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`min-h-12 rounded-full px-4 text-sm font-bold ${
              kind === k ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"
            }`}
          >
            {COURTESY_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-gold min-h-12" disabled={Boolean(busy)} onClick={() => void grant()}>
          {busy === "grant" ? "Liberando…" : open ? "Atualizar liberação" : "Liberar para o paciente agendar"}
        </button>
        {open && (
          <button type="button" className="btn-ghost min-h-12" disabled={Boolean(busy)} onClick={() => void revoke(open.id)}>
            {busy === "revoke" ? "Removendo…" : "Cancelar liberação"}
          </button>
        )}
      </div>
      {msg && <p className="text-sm font-semibold text-[var(--gold)]">{msg}</p>}
      {err && <p className="text-sm font-semibold text-[var(--danger)]">{err}</p>}
    </div>
  );
}
