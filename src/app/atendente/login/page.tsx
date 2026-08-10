"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AtendenteLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/atendente/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível entrar.");
      router.replace("/atendente/painel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Atendente / Secretária</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Entrar</h1>
      <p className="mt-2 text-[var(--text-muted)]">Use seu <strong>CPF ou e-mail</strong> e a senha fornecida pelo médico.</p>
      <form onSubmit={onSubmit} noValidate className="panel mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">CPF ou e-mail</span>
          <input type="text" className="input-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Senha</span>
          <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}
        <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--text-muted)]">É médico? <Link href="/medicos/login" className="font-semibold text-[var(--gold)]">Entrar como médico</Link></p>
    </div>
  );
}
