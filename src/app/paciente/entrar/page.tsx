"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { postJson, toFriendlyMessage } from "@/lib/user-errors";

function EntrarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"cpf" | "email">("cpf");
  const [cpf, setCpf] = useState(params.get("cpf") || "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(payload: Record<string, string>) {
    setLoading(true);
    setError("");
    try {
      await postJson("/api/patient/session", payload, "Não foi possível entrar. Confira os dados e tente novamente.");
      router.push(params.get("next") || "/paciente/inicio");
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível entrar. Confira os dados e tente novamente."));
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
        Entre para registrar pressão, glicemia, peso, ver consultas, exames e documentos.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => { setMode("cpf"); setError(""); }}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${mode === "cpf" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}
        >
          CPF e senha
        </button>
        <button
          type="button"
          onClick={() => { setMode("email"); setError(""); }}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${mode === "email" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}
        >
          E-mail
        </button>
      </div>

      {mode === "cpf" ? (
        <form
          onSubmit={(e) => { e.preventDefault(); submit({ cpf, password }); }}
          noValidate
          className="panel mt-4 space-y-4"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">CPF</span>
            <input
              inputMode="numeric"
              className="input-field"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="Somente números"
              autoComplete="username"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Senha</span>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha inicial: 123456"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
          )}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <p className="text-center text-xs text-[var(--text-muted)]">
            Seu médico criou seu acesso? A senha inicial é <b>123456</b> — você pode trocá-la depois de entrar.
          </p>
        </form>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); submit({ email }); }}
          noValidate
          className="panel mt-4 space-y-4"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">E-mail</span>
            <input
              type="text"
              inputMode="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              required
            />
          </label>
          {error && (
            <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
          )}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <p className="text-center text-xs text-[var(--text-muted)]">
            Use o mesmo e-mail dos seus agendamentos.
          </p>
        </form>
      )}

      <div className="mt-5 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4 text-center">
        <p className="text-sm font-semibold text-[var(--text)]">Ainda não tem conta?</p>
        <Link href="/paciente/criar" className="btn-gold mt-2 w-full">Criar minha conta</Link>
        <p className="mt-2 text-xs text-[var(--text-muted)]">Basta nome e CPF. Você completa o resto depois.</p>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
        <Link href="/agendar" className="font-semibold text-[var(--gold)]">Quer agendar uma consulta? Clique aqui</Link>
      </p>
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
