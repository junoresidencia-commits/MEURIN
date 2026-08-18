"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { postJson, toFriendlyMessage } from "@/lib/user-errors";

function TrocarSenhaInner() {
  const router = useRouter();
  const params = useSearchParams();
  const primeiro = params.get("primeiro") === "1";
  const next = params.get("next") || "/paciente/inicio";

  const [current, setCurrent] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pass.length < 8) { setError("A nova senha deve ter pelo menos 8 caracteres."); return; }
    if (pass === "123456") { setError("Escolha uma senha diferente de 123456."); return; }
    if (pass !== confirm) { setError("A confirmação não confere com a nova senha."); return; }
    setLoading(true);
    try {
      await postJson("/api/patient/password", { currentPassword: current, newPassword: pass }, "Não foi possível salvar a senha.");
      setDone(true);
      setTimeout(() => router.push(next), 1000);
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível salvar a senha."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      {!primeiro && <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">← Voltar</Link>}
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">
        {primeiro ? "Crie sua senha de acesso" : "Trocar senha"}
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {primeiro
          ? "Este é o seu primeiro acesso. Crie uma senha pessoal (mínimo 8 caracteres) para proteger seus dados. Ela não fica visível para ninguém."
          : "Defina uma senha só sua (mínimo 8 caracteres, diferente de 123456)."}
      </p>

      {done ? (
        <p className="panel mt-6 text-sm font-semibold text-[var(--green,#0d9488)]">Senha criada ✅ Entrando…</p>
      ) : (
        <form onSubmit={submit} className="panel mt-6 space-y-4" noValidate>
          {!primeiro && (
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Senha atual</span>
              <input type="password" className="input-field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
            </label>
          )}
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Nova senha</span>
            <input type="password" className="input-field" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Confirmar nova senha</span>
            <input type="password" className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </label>
          {error && (
            <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
          )}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Salvando…" : primeiro ? "Criar senha e entrar" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function TrocarSenhaPage() {
  return (
    <Suspense fallback={null}>
      <TrocarSenhaInner />
    </Suspense>
  );
}
