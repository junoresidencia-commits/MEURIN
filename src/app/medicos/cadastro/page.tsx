"use client";

import { useState } from "react";
import Link from "next/link";

export default function CadastroMedicoPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    crm: "",
    crmState: "",
    rqe: "",
    specialty: "Nefrologia",
    clinic: "",
    bio: "",
    consultationPriceCents: "350",
    pixKey: "",
    cpf: "",
    cns: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <p className="text-sm font-semibold text-[var(--green)]">Cadastro recebido</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
          Cadastro recebido com sucesso
        </h1>
        <div className="panel mt-8 space-y-4 text-[var(--text-soft)]">
          <p>
            Seus dados serão analisados pelo administrador do Meu Rim. Você
            receberá um aviso após a aprovação.
          </p>
          <Link href="/medicos/login" className="btn-gold w-full">
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  const fields = [
    ["name", "Nome completo", "text", true],
    ["email", "E-mail", "email", true],
    ["password", "Senha", "password", true],
    ["phone", "Telefone", "tel", true],
    ["crm", "CRM", "text", true],
    ["crmState", "Estado do CRM (UF)", "text", true],
    ["cpf", "CPF", "text", true],
    ["cns", "CNS (Cartão Nacional de Saúde)", "text", true],
    ["rqe", "RQE (se houver)", "text", false],
    ["specialty", "Especialidade", "text", true],
    ["clinic", "Clínica / local de atendimento", "text", false],
    ["pixKey", "Chave Pix (para receber)", "text", false],
  ] as const;

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <p className="text-sm font-semibold text-[var(--gold)]">Área médica</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
        Seu prontuário nefrológico onde você estiver
      </h1>
      <p className="mt-3 text-[var(--text-muted)]">
        Atenda presencialmente ou online e mantenha pacientes, exames, documentos e evolução renal
        organizados em um só lugar. O acesso é liberado após aprovação do administrador.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
        {fields.map(([key, label, type, required]) => (
          <label key={key} className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              {label}
            </span>
            <input
              type={type}
              className="input-field"
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              required={required}
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
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
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            Bio
          </span>
          <textarea
            className="input-field min-h-[100px]"
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </label>

        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <button type="submit" className="btn-gold w-full" disabled={loading}>
          {loading ? "Enviando…" : "Enviar solicitação"}
        </button>
        <p className="text-center text-sm text-[var(--text-muted)]">
          Já tem conta?{" "}
          <Link href="/medicos/login" className="font-semibold text-[var(--gold)]">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
