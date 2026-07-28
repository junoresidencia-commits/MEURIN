"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CadastroMedicoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    crm: "",
    specialty: "Nefrologia",
    bio: "",
    consultationPriceCents: "350",
    pixKey: "",
    bankAccountHint: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          consultationPriceCents: Math.round(Number(form.consultationPriceCents) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no cadastro");

      const login = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      if (!login.ok) throw new Error("Conta criada, mas o login automático falhou.");
      router.push("/medicos/painel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Equipe médica
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">
        Cadastre sua conta
      </h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Você e seus colegas entram com CRM, definem agenda e recebem o pagamento
        direto na conta (Pix/conta bancária).
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
        {(
          [
            ["name", "Nome completo", "text"],
            ["email", "E-mail", "email"],
            ["password", "Senha", "password"],
            ["crm", "CRM", "text"],
            ["specialty", "Especialidade", "text"],
            ["pixKey", "Chave Pix (para receber)", "text"],
            ["bankAccountHint", "Conta bancária (opcional)", "text"],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              {label}
            </span>
            <input
              type={type}
              className="input-field"
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              required={!["pixKey", "bankAccountHint"].includes(key)}
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
            Valor da consulta (R$)
          </span>
          <input
            type="number"
            min="50"
            step="1"
            className="input-field"
            value={form.consultationPriceCents}
            onChange={(e) => set("consultationPriceCents", e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
            Bio
          </span>
          <textarea
            className="input-field min-h-[100px]"
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Salvando…" : "Criar conta médica"}
        </button>
        <p className="text-center text-sm text-[var(--text-muted)]">
          Já tem conta?{" "}
          <Link href="/medicos/login" className="text-[var(--gold-light)]">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
