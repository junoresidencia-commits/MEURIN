"use client";

import { useEffect, useMemo, useState } from "react";

type Doc = { type: string; version: string; title: string; body: string; sha256: string };

function clientInfo() {
  let sessionId = "";
  try {
    sessionId = sessionStorage.getItem("mr_sid") || "";
    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now());
      sessionStorage.setItem("mr_sid", sessionId);
    }
  } catch {
    /* ignore */
  }
  return {
    language: typeof navigator !== "undefined" ? navigator.language : "",
    screenResolution:
      typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "",
    sessionId,
  };
}

/**
 * Tela de aceite obrigatório. Renderiza os documentos pendentes com caixas de
 * aceite; "Continuar" só habilita quando todos os obrigatórios são marcados.
 */
export function ConsentGate({
  email,
  onAccepted,
  submitLabel = "Continuar",
}: {
  email: string;
  onAccepted: () => void;
  submitLabel?: string;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dRes, sRes] = await Promise.all([
          fetch("/api/consent/documents"),
          fetch(`/api/consent/status?email=${encodeURIComponent(email)}`),
        ]);
        const dData = await dRes.json();
        const sData = await sRes.json();
        if (cancelled) return;
        setDocs(dData.documents || []);
        const pend: string[] = sData.pending || [];
        setPending(pend);
        if (pend.length === 0) {
          onAccepted();
          return;
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar os termos.");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const pendingDocs = useMemo(
    () => docs.filter((d) => pending.includes(d.type)),
    [docs, pending]
  );
  const allChecked = pendingDocs.length > 0 && pendingDocs.every((d) => checked[d.type]);

  async function submit() {
    if (!allChecked) return;
    setSaving(true);
    setError("");
    try {
      const accepted: Record<string, boolean> = {};
      pendingDocs.forEach((d) => (accepted[d.type] = true));
      const res = await fetch("/api/consent/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, accepted, client: clientInfo() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível registrar o aceite.");
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="px-5 py-16 text-center text-[var(--text-muted)]">Carregando termos…</div>;
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <p className="text-sm font-semibold text-[var(--gold)]">Antes de continuar</p>
      <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">
        Aceite dos termos
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Para usar a plataforma, leia e aceite os documentos abaixo.
      </p>

      <div className="mt-6 space-y-3">
        {pendingDocs.map((d) => (
          <div key={d.type} className="panel">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--gold)]"
                checked={Boolean(checked[d.type])}
                onChange={(e) => setChecked((c) => ({ ...c, [d.type]: e.target.checked }))}
              />
              <span>
                <span className="text-sm font-semibold text-[var(--text)]">
                  Li e aceito — {d.title}
                </span>
                <button
                  type="button"
                  className="mt-1 block text-xs font-semibold text-[var(--gold)]"
                  onClick={() => setOpenDoc(openDoc === d.type ? null : d.type)}
                >
                  {openDoc === d.type ? "Fechar documento" : "Ler documento"}
                </button>
              </span>
            </label>
            {openDoc === d.type && (
              <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs leading-relaxed text-[var(--text-soft)]">
                {d.body}
                <p className="mt-3 text-[10px] text-[var(--text-muted)]">
                  Versão {d.version} · SHA-256 {d.sha256.slice(0, 16)}…
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-gold mt-6 w-full"
        disabled={!allChecked || saving}
        onClick={submit}
      >
        {saving ? "Registrando…" : submitLabel}
      </button>
      <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">
        O aceite é registrado com data/hora do servidor, versão do documento e
        assinatura eletrônica vinculada ao seu acesso.
      </p>
    </div>
  );
}
