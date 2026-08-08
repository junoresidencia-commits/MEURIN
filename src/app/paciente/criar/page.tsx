"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CriarContaPacientePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", cpf: "", password: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patient/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível criar a conta.");
      router.push("/paciente/inicio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <p className="text-sm font-semibold text-[var(--gold)]">Área do paciente</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Criar minha conta</h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Preencha pelo menos o nome e o CPF. Você poderá completar ou alterar os dados depois, inclusive na consulta.
      </p>

      <form onSubmit={submit} noValidate className="panel mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Nome completo *</span>
          <input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">CPF *</span>
          <input className="input-field" inputMode="numeric" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="Somente números" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Senha</span>
          <input type="password" className="input-field" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Qualquer senha que você quiser (ou deixe em branco = 123456)" autoComplete="new-password" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail (opcional)</span>
            <input type="text" inputMode="email" className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone (opcional)</span>
            <input className="input-field" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
        </div>
        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
        )}
        <button type="submit" className="btn-gold w-full" disabled={loading || !form.name.trim() || !form.cpf.trim()}>
          {loading ? "Criando…" : "Criar conta e entrar"}
        </button>
        <p className="text-center text-sm text-[var(--text-muted)]">
          Já tem conta? <Link href="/paciente/entrar" className="font-semibold text-[var(--gold)]">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
