"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

export default function NutricionistaLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/nutricionista/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível entrar.");
      router.push("/nutricionista/painel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      back={{ href: "/" }}
      eyebrow="Área da nutricionista"
      title="Entrar"
      subtitle="Acesso para nutricionistas vinculadas por um médico. Use seu CPF ou e-mail e a senha."
    >
      <form onSubmit={submit} className="panel space-y-3" noValidate>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF ou e-mail</span>
          <input className="input-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} inputMode="text" autoComplete="username" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Senha</span>
          <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <button type="submit" className="btn-gold w-full" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
        <p className="text-xs text-[var(--text-muted)]">Ainda não tem conta? <Link href="/nutricionista/cadastro" className="font-semibold text-[var(--gold)]">Criar cadastro</Link>. Se foi adicionada por um médico, a senha inicial é <b>123456</b>.</p>
      </form>
    </AuthShell>
  );
}
