"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toFriendlyMessage } from "@/lib/user-errors";

type ClaimHint = {
  maskedName: string;
  needsPhone: boolean;
  needsBirthdate: boolean;
};

export default function CriarContaPacientePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    password: "",
    email: "",
    phone: "",
    birthdate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [claim, setClaim] = useState<ClaimHint | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (claim) {
        const res = await fetch("/api/patient/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            cpf: form.cpf,
            password: form.password,
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            birthdate: form.birthdate.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Não foi possível conectar ao cadastro.");
        router.push("/paciente/inicio");
        return;
      }

      const res = await fetch("/api/patient/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          cpf: form.cpf,
          password: form.password,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === "cpf_exists" && data.claimable) {
        setClaim({
          maskedName: data.maskedName || "cadastro encontrado",
          needsPhone: Boolean(data.needsPhone),
          needsBirthdate: Boolean(data.needsBirthdate),
        });
        setError("");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível criar sua conta.");
      router.push("/paciente/inicio");
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível criar sua conta. Confira os dados e tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <Link href="/paciente/entrar" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)]">← Voltar</Link>
      <p className="text-sm font-semibold text-[var(--gold)]">Área do paciente</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
        {claim ? "Conectar ao cadastro" : "Criar minha conta"}
      </h1>
      <p className="mt-3 text-[var(--text-muted)]">
        {claim
          ? "Encontramos um cadastro relacionado ao seu CPF. Confirme sua identidade para acessar o acompanhamento no Meu Rim."
          : "Preencha pelo menos o nome e o CPF. Você poderá completar ou alterar os dados depois, inclusive na consulta."}
      </p>

      {claim && (
        <div className="mt-4 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4 text-sm text-[var(--text-soft)]">
          <p className="font-semibold text-[var(--text)]">Cadastro encontrado: {claim.maskedName}</p>
          <p className="mt-1">
            O CPF sozinho não autentica. Confirme o nome completo
            {claim.needsPhone ? " e os 4 últimos dígitos do telefone" : ""}
            {claim.needsBirthdate ? " e a data de nascimento" : ""}
            {" "}cadastrados. Depois escolha sua senha.
          </p>
          <p className="mt-2 text-xs">
            Já tem senha?{" "}
            <Link href={`/paciente/entrar?cpf=${encodeURIComponent(form.cpf.replace(/\D/g, ""))}`} className="font-semibold text-[var(--gold)]">
              Entrar
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={submit} noValidate className="panel mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Nome completo *</span>
          <input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">CPF *</span>
          <input
            className="input-field"
            inputMode="numeric"
            value={form.cpf}
            onChange={(e) => {
              set("cpf", e.target.value);
              if (claim) setClaim(null);
            }}
            placeholder="Somente números"
            required
            readOnly={Boolean(claim)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            {claim ? "Nova senha *" : "Senha"}
          </span>
          <input
            type="password"
            className="input-field"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={claim ? "Defina sua senha de acesso" : "Qualquer senha (ou deixe em branco = 123456)"}
            autoComplete="new-password"
            required={Boolean(claim)}
          />
        </label>
        {claim?.needsPhone && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              Telefone cadastrado (últimos 4 dígitos ou completo) *
            </span>
            <input className="input-field" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
          </label>
        )}
        {claim?.needsBirthdate && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Data de nascimento *</span>
            <input type="date" className="input-field" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} required />
          </label>
        )}
        {!claim && (
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
        )}
        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
        )}
        <button type="submit" className="btn-gold w-full" disabled={loading || !form.name.trim() || !form.cpf.trim()}>
          {loading ? "Aguarde…" : claim ? "Confirmar e conectar" : "Criar conta e entrar"}
        </button>
        <p className="text-center text-sm text-[var(--text-muted)]">
          Já tem conta? <Link href="/paciente/entrar" className="font-semibold text-[var(--gold)]">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
