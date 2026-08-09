"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson, toFriendlyMessage } from "@/lib/user-errors";

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    setLoading(true);
    try {
      await postJson("/api/patient/password", { currentPassword: current, newPassword: next }, "Não foi possível trocar a senha.");
      setDone(true);
      setTimeout(() => router.push("/paciente/inicio"), 1200);
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível trocar a senha."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">← Voltar</Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Trocar senha</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Se você ainda usa a senha inicial <b>123456</b>, defina uma senha só sua.
      </p>

      {done ? (
        <p className="panel mt-6 text-sm font-semibold text-[var(--green)]">Senha atualizada ✅</p>
      ) : (
        <form onSubmit={submit} className="panel mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Senha atual</span>
            <input type="password" className="input-field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Nova senha</span>
            <input type="password" className="input-field" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Confirmar nova senha</span>
            <input type="password" className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </label>
          {error && (
            <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
          )}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </div>
  );
}
