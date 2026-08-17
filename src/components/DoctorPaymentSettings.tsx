"use client";

import { useEffect, useState } from "react";

/** Recebimentos via Mercado Pago (token é segredo — só o status volta ao navegador). */
export function DoctorPaymentSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [platformFallback, setPlatformFallback] = useState(false);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/doctor/payment")
      .then((r) => r.json())
      .then((d) => {
        setConnected(Boolean(d.connected));
        setPlatformFallback(Boolean(d.platformFallback));
      })
      .catch(() => setConnected(false));
  }, []);

  async function save() {
    setSaving(true);
    setErr("");
    setMsg("");
    const res = await fetch("/api/doctor/payment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setConnected(true);
      setToken("");
      setMsg("Conta conectada. As próximas consultas serão pagas na sua conta Mercado Pago.");
    } else {
      setErr(data.error || "Não foi possível salvar.");
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar a sua conta Mercado Pago?")) return;
    setSaving(true);
    setErr("");
    setMsg("");
    const res = await fetch("/api/doctor/payment", { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      setConnected(false);
      setMsg("Conta desconectada.");
    } else {
      setErr("Não foi possível desconectar.");
    }
  }

  if (connected === null) {
    return <div className="panel mt-4 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="panel mt-4">
      {connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--teal-soft,#d7f2ee)] text-[var(--teal,#0d9488)]">✓</span>
            <div>
              <p className="font-semibold text-[var(--text)]">Sua conta Mercado Pago está conectada</p>
              <p className="text-sm text-[var(--text-muted)]">O valor das suas consultas é depositado direto na sua conta.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
          >
            Desconectar
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[var(--text-soft)]">
            {platformFallback
              ? "No momento, os pagamentos das suas consultas caem na conta da plataforma. Conecte a sua conta para receber diretamente."
              : "Conecte a sua conta para habilitar o pagamento das suas consultas."}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--text-muted)]">
            <li>
              Entre no{" "}
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--teal,#0d9488)] underline"
              >
                painel de desenvolvedores do Mercado Pago
              </a>{" "}
              com a sua conta.
            </li>
            <li>Crie uma aplicação (ou use uma existente) e abra <strong>Credenciais de produção</strong>.</li>
            <li>Copie o <strong>Access Token</strong> (começa com <code>APP_USR-</code>) e cole abaixo.</li>
          </ol>
          <label className="mt-3 block text-sm font-medium text-[var(--text)]" htmlFor="mp-token">Access Token do Mercado Pago</label>
          <input
            id="mp-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="APP_USR-..."
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--teal,#0d9488)]"
          />
          <button type="button" onClick={save} disabled={saving || !token.trim()} className="btn-gold mt-3 disabled:opacity-50">
            {saving ? "Conectando…" : "Conectar conta"}
          </button>
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-[var(--teal,#0d9488)]">{msg}</p>}
      {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
