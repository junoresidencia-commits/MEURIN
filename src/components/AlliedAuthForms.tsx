"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import type { AlliedRole } from "@/lib/allied-types";

const META: Record<AlliedRole, { eyebrow: string; subtitle: string; cadastro: string; painel: string }> = {
  psychology: {
    eyebrow: "Área da psicologia",
    subtitle: "Acesso para psicólogos vinculados por um médico. Use CPF ou e-mail e a senha.",
    cadastro: "/psicologo/cadastro",
    painel: "/psicologo/painel",
  },
  nursing: {
    eyebrow: "Área da enfermagem",
    subtitle: "Acesso para enfermeiros vinculados por um médico. Use CPF ou e-mail e a senha.",
    cadastro: "/enfermeiro/cadastro",
    painel: "/enfermeiro/painel",
  },
};

export function AlliedLoginForm({ role }: { role: AlliedRole }) {
  const router = useRouter();
  const meta = META[role];
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/allied/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível entrar.");
      router.push(meta.painel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally { setLoading(false); }
  }

  return (
    <AuthShell back={{ href: "/" }} eyebrow={meta.eyebrow} title="Entrar" subtitle={meta.subtitle}>
      <form onSubmit={submit} className="panel space-y-3" noValidate>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF ou e-mail</span>
          <input className="input-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Senha</span>
          <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <button type="submit" className="btn-gold w-full" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
        <p className="text-xs text-[var(--text-muted)]">Ainda não tem conta? <Link href={meta.cadastro} className="font-semibold text-[var(--gold)]">Criar cadastro</Link>. Se foi adicionado por um médico, a senha inicial é <b>123456</b>.</p>
      </form>
    </AuthShell>
  );
}

export function AlliedRegisterForm({ role }: { role: AlliedRole }) {
  const registry = role === "psychology" ? "CRP" : "COREN";
  const login = role === "psychology" ? "/psicologo/login" : "/enfermeiro/login";
  const [form, setForm] = useState({ name: "", cpf: "", email: "", password: "", phone: "", registry: "", uf: "", specialty: "", bio: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/allied/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, ...form }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha no cadastro.");
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <p className="text-sm font-semibold text-[var(--green,#0d9488)]">Cadastro enviado</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Recebemos seu cadastro</h1>
        <div className="panel mt-6 space-y-3 text-[var(--text-soft)]">
          <p>Seu cadastro fica visível para os médicos em <b>Profissionais disponíveis</b>. Você entra depois que um médico adicionar você à equipe, ou após aprovação do administrador.</p>
          <Link href={login} className="btn-gold w-full">Ir para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <Link href={login} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)]">← Voltar</Link>
      <p className="text-sm font-semibold text-[var(--gold)]">{role === "psychology" ? "Área da psicologia" : "Área da enfermagem"}</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Criar cadastro</h1>
      <p className="mt-2 text-[var(--text-muted)]">Cadastre-se para atender pacientes encaminhados no Meu Rim.</p>
      <form onSubmit={submit} className="panel mt-6 grid gap-3 sm:grid-cols-2" noValidate>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo *</span><input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF *</span><input className="input-field" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} inputMode="numeric" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span><input className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Senha *</span><input className="input-field" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone</span><input className="input-field" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{registry}</span><input className="input-field" value={form.registry} onChange={(e) => set("registry", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">UF</span><input className="input-field" value={form.uf} onChange={(e) => set("uf", e.target.value)} placeholder="BA" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span><input className="input-field" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} /></label>
        {error && <p className="sm:col-span-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <div className="sm:col-span-2"><button type="submit" className="btn-gold w-full" disabled={loading}>{loading ? "Enviando…" : "Enviar cadastro"}</button></div>
      </form>
    </div>
  );
}
