"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, toFriendlyMessage } from "@/lib/user-errors";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await postJson("/api/admin/session", { email, password }, "E-mail ou senha inválidos.");
      router.push("/admin");
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível entrar. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="text-sm font-semibold text-[var(--gold)]">Administração</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
        Entrar como administrador
      </h1>
      <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">E-mail</span>
          <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Senha</span>
          <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
        )}
        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
