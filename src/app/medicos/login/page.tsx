"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson, toFriendlyMessage } from "@/lib/user-errors";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { AuthShell } from "@/components/AuthShell";

export default function LoginMedicoPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    <AuthShell back={{ href: "/" }} eyebrow="Área do médico" title="Bem-vindo de volta!" subtitle="Faça login para continuar.">
        <div className="panel">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span>
              <input
                type="text"
                inputMode="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="voce@exemplo.com"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">Senha</span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className="input-field pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--gold)]">
                  {showPw ? "ocultar" : "ver"}
                </button>
              </div>
            </label>
            <div className="flex justify-end">
              <Link href="/medicos/recuperar" className="text-sm font-semibold text-[var(--gold)]">Esqueceu sua senha?</Link>
            </div>
            {error && (
              <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
            )}
            <button type="submit" className="btn-gold w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <GoogleSignInButton />

          <div className="mt-5 border-t border-[var(--border)] pt-4 text-center text-sm text-[var(--text-muted)]">
            Ainda não possui cadastro?{" "}
            <Link href="/medicos/cadastro" className="font-semibold text-[var(--gold)]">Solicitar cadastro</Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
          <Link href="/paciente/entrar" className="hover:text-[var(--gold)]">Sou paciente</Link>
          <Link href="/atendente/login" className="hover:text-[var(--gold)]">Sou atendente</Link>
          <Link href="/nutricionista/login" className="hover:text-[var(--gold)]">Sou nutricionista</Link>
        </div>
    </AuthShell>
  );
}
