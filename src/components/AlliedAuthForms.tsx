"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import type { AlliedRole } from "@/lib/allied-types";
import { alliedAreaEyebrow, DOCTOR_SPECIALTY_OPTIONS, isDoctorTeamRole, ROLE_META } from "@/lib/allied-types";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
      {children}
    </span>
  );
}

export function AlliedLoginForm({ role }: { role: AlliedRole }) {
  const router = useRouter();
  const cadastro = isDoctorTeamRole(role) ? "/medicos/cadastro" : `${ROLE_META[role].path}/cadastro`;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const doctor = isDoctorTeamRole(role);

  const subtitle = doctor
    ? "Entre com CPF ou e-mail e a senha. Se o nefrologista já te adicionou na equipe, a senha inicial é 123456."
    : `Acesso para ${ROLE_META[role].plural.toLowerCase()} vinculados por um médico. Use CPF ou e-mail e a senha.`;

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
      const destRole = (data.role as AlliedRole) || role;
      const path = ROLE_META[destRole]?.path || ROLE_META[role].path;
      router.push(`${path}/painel`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally { setLoading(false); }
  }

  return (
    <AuthShell back={{ href: "/" }} eyebrow={alliedAreaEyebrow(role)} title="Entrar" subtitle={subtitle}>
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
        <p className="text-xs text-[var(--text-muted)]">
          Ainda não tem conta? <Link href={cadastro} className="font-semibold text-[var(--gold)]">Criar cadastro</Link>
          {doctor ? ". Se foi adicionado na Minha Equipe, a senha inicial é " : ". Se foi adicionado por um médico, a senha inicial é "}
          <b>123456</b>.
        </p>
      </form>
    </AuthShell>
  );
}

export function AlliedRegisterForm({ role }: { role: AlliedRole }) {
  const registry = ROLE_META[role].registry;
  const login = `${ROLE_META[role].path}/login`;
  const doctor = isDoctorTeamRole(role);
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    email: "",
    password: "",
    phone: "",
    registry: "",
    uf: "",
    specialty: role === "cardiology" ? "Cardiologia" : role === "endocrinology" ? "Endocrinologia" : "",
    specialtyOther: "",
    bio: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneRole, setDoneRole] = useState<AlliedRole | null>(null);
  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  const specialtyValue = form.specialty === "Outra" ? form.specialtyOther.trim() : form.specialty.trim();
  const doneLogin = `${ROLE_META[doneRole || role].path}/login`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (doctor && !form.registry.trim()) { setError("Informe o CRM."); return; }
    if (doctor && !form.uf.trim()) { setError("Informe a UF do CRM."); return; }
    if (role === "physician" && !specialtyValue) { setError("Informe a especialidade."); return; }
    if (form.password.length < 6) { setError("Crie uma senha com pelo menos 6 caracteres."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/allied/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, ...form, specialty: specialtyValue || form.specialty }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha no cadastro.");
      setDoneRole((d.role as AlliedRole) || role);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setLoading(false); }
  }

  if (doneRole) {
    return (
      <AuthShell back={{ href: doneLogin }} eyebrow={alliedAreaEyebrow(doneRole)} title="Cadastro recebido">
        <div className="panel space-y-3 text-[var(--text-soft)]">
          <p>
            Seu cadastro fica visível para o nefrologista em <b>Minha Equipe › Profissionais disponíveis</b>.
            Você entra depois que ele te adicionar à equipe, ou após aprovação do administrador.
          </p>
          <Link href={doneLogin} className="btn-gold w-full">Ir para o login</Link>
        </div>
      </AuthShell>
    );
  }

  if (doctor) {
    return (
      <AuthShell
        wide
        back={{ href: login, label: "Login" }}
        eyebrow="Área do médico"
        title="Criar cadastro de médico"
        subtitle="Nome, CRM, especialidade e senha — o cadastro normal. Depois o nefrologista te adiciona na Minha Equipe para encaminhar pacientes."
      >
        <form onSubmit={submit} className="panel space-y-4" noValidate>
          <label className="block">
            <FieldLabel>Nome completo</FieldLabel>
            <input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
          </label>
          <label className="block">
            <FieldLabel>E-mail</FieldLabel>
            <input className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" autoCapitalize="none" />
          </label>
          <label className="block">
            <FieldLabel>Senha</FieldLabel>
            <input className="input-field" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
          </label>
          <label className="block">
            <FieldLabel>Telefone</FieldLabel>
            <input className="input-field" value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          </label>
          <label className="block">
            <FieldLabel>CRM</FieldLabel>
            <input className="input-field" value={form.registry} onChange={(e) => set("registry", e.target.value)} />
          </label>
          <label className="block">
            <FieldLabel>Estado do CRM (UF)</FieldLabel>
            <input className="input-field" value={form.uf} onChange={(e) => set("uf", e.target.value)} placeholder="Ex.: BA" maxLength={2} />
          </label>
          <label className="block">
            <FieldLabel>CPF</FieldLabel>
            <input className="input-field" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} inputMode="numeric" />
          </label>
          {role === "physician" ? (
            <>
              <label className="block">
                <FieldLabel>Especialidade</FieldLabel>
                <select className="input-field" value={form.specialty} onChange={(e) => set("specialty", e.target.value)}>
                  <option value="">Selecione</option>
                  {DOCTOR_SPECIALTY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              {form.specialty === "Outra" && (
                <label className="block">
                  <FieldLabel>Qual especialidade?</FieldLabel>
                  <input className="input-field" value={form.specialtyOther} onChange={(e) => set("specialtyOther", e.target.value)} placeholder="Ex.: Angiologia, Nefrologia pediátrica" />
                </label>
              )}
            </>
          ) : (
            <label className="block">
              <FieldLabel>Especialidade</FieldLabel>
              <input className="input-field" value={form.specialty} readOnly />
            </label>
          )}
          <label className="block">
            <FieldLabel>Bio</FieldLabel>
            <textarea className="input-field min-h-[100px]" value={form.bio} onChange={(e) => set("bio", e.target.value)} />
          </label>
          {error && (
            <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Enviando…" : "Enviar cadastro"}
          </button>
          <p className="text-center text-sm text-[var(--text-muted)]">
            Já tem conta?{" "}
            <Link href="/medicos/login" className="font-semibold text-[var(--gold)]">Entrar</Link>
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <Link href={login} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)]">← Voltar</Link>
      <p className="text-sm font-semibold text-[var(--gold)]">{alliedAreaEyebrow(role)}</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Criar cadastro</h1>
      <p className="mt-2 text-[var(--text-muted)]">Cadastre-se para atender pacientes encaminhados no Meu Rim.</p>
      <form onSubmit={submit} className="panel mt-6 grid gap-3 sm:grid-cols-2" noValidate>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo *</span><input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF *</span><input className="input-field" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} inputMode="numeric" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span><input className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Senha *</span><input className="input-field" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone</span><input className="input-field" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{registry}</span><input className="input-field" value={form.registry} onChange={(e) => set("registry", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">UF do {registry}</span><input className="input-field" value={form.uf} onChange={(e) => set("uf", e.target.value)} placeholder="BA" /></label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span>
          <input className="input-field" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} />
        </label>
        {error && <p className="sm:col-span-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <div className="sm:col-span-2"><button type="submit" className="btn-gold w-full" disabled={loading}>{loading ? "Enviando…" : "Enviar cadastro"}</button></div>
      </form>
    </div>
  );
}
