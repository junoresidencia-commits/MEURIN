"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function EntrarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patient/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível entrar.");
      const next = params.get("next") || "/paciente/inicio";
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <p className="text-sm font-semibold text-[var(--gold)]">Área do paciente</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
        Acompanhe sua saúde
      </h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Entre com o e-mail para registrar pressão, glicemia, peso e alimentação, e
        ver suas consultas. Use o mesmo e-mail dos seus agendamentos.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            E-mail
          </span>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            required
          />
        </label>
        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-xs text-[var(--text-muted)]">
          Acesso simplificado do ambiente de demonstração. Em produção, login com
          senha e verificação em duas etapas.
        </p>
      </form>
    </div>
  );
}

export default function PacienteEntrarPage() {
  return (
    <Suspense fallback={null}>
      <EntrarInner />
    </Suspense>
  );
}
