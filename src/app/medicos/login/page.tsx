"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginMedicoPage() {
  const router = useRouter();
  const [email, setEmail] = useState("carlos@meurim.com");
  const [password, setPassword] = useState("medico123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no login");
      router.push("/medicos/painel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Área do médico
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">Entrar</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        Demo: carlos@meurim.com / medico123
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
            E-mail
          </span>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
            Senha
          </span>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Entrando…" : "Acessar painel"}
        </button>
        <p className="text-center text-sm text-[var(--text-muted)]">
          Novo na plataforma?{" "}
          <Link href="/medicos/cadastro" className="text-[var(--gold-light)]">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  );
}
