"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson, toFriendlyMessage } from "@/lib/user-errors";

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
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-[var(--gold-soft)] to-[var(--bg)] px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-sm font-extrabold text-white shadow-[var(--shadow-gold)]">MR</span>
          <span className="font-display text-2xl font-extrabold text-[var(--text)]">Meu <span className="text-[var(--gold)]">Rim</span></span>
        </Link>

        <div className="panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">Área do médico</p>
          <h1 className="font-display mt-1 text-2xl font-extrabold text-[var(--text)]">Bem-vindo de volta!</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Faça login para continuar.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
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
      </div>
    </div>
  );
}
