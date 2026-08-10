"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson, toFriendlyMessage } from "@/lib/user-errors";

export default function LoginMedicoPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await postJson("/api/auth", { email, password }, "E-mail ou senha inválidos.");
      router.push("/medicos/painel");
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível entrar. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="text-sm font-semibold text-[var(--gold)]">Área do médico</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Entrar</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        Seu prontuário nefrológico onde você estiver. Atenda. Registre. Acompanhe seus pacientes.
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
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            Senha
          </span>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
        <div className="flex flex-col items-center gap-2 pt-1 text-sm">
          <Link href="/medicos/recuperar" className="text-[var(--text-muted)] hover:text-[var(--gold)]">
            Esqueci minha senha
          </Link>
          <span className="text-[var(--text-muted)]">
            Ainda não possui cadastro?{" "}
            <Link href="/medicos/cadastro" className="font-semibold text-[var(--gold)]">
              Solicitar cadastro
            </Link>
          </span>
          <Link href="/atendente/login" className="text-[var(--text-muted)] hover:text-[var(--gold)]">
            Sou atendente / secretária
          </Link>
        </div>
      </form>
    </div>
  );
}
