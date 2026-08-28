"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { DOCTOR_CADASTRO_SPECIALTIES, isNephrologySpecialty } from "@/lib/allied-types";

function CadastroMedicoForm() {
  const search = useSearchParams();
  const preset = useMemo(() => {
    const raw = String(search.get("esp") || "").trim();
    if (!raw) return "Nefrologia";
    const match = DOCTOR_CADASTRO_SPECIALTIES.find((opt) => opt.toLowerCase() === raw.toLowerCase());
    return match || "Nefrologia";
  }, [search]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    crm: "",
    crmState: "",
    rqe: "",
    specialty: preset,
    specialtyOther: "",
    clinic: "",
    bio: "",
    consultationPriceCents: "350",
    pixKey: "",
    cpf: "",
    cns: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"clinic" | "specialist" | "">("");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const specialtyValue = form.specialty === "Outra" ? form.specialtyOther.trim() : form.specialty.trim();
  const nephrology = isNephrologySpecialty(specialtyValue || form.specialty);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!specialtyValue) { setError("Informe a especialidade."); return; }
    if (form.password.length < 6) { setError("Crie uma senha com pelo menos 6 caracteres."); return; }
    setLoading(true);
    setError("");
    try {
      if (nephrology) {
        const res = await fetch("/api/doctors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            specialty: specialtyValue,
            consultationPriceCents: Math.round(Number(form.consultationPriceCents) * 100),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha no cadastro");
        setDone("clinic");
      } else {
        const res = await fetch("/api/allied/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "physician",
            name: form.name,
            email: form.email,
            password: form.password,
            phone: form.phone,
            registry: form.crm,
            uf: form.crmState,
            cpf: form.cpf,
            specialty: specialtyValue,
            bio: form.bio,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha no cadastro");
        setDone("specialist");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell eyebrow="Cadastro recebido" title="Cadastro recebido com sucesso">
        <div className="panel space-y-4 text-[var(--text-soft)]">
          <p>
            {done === "clinic"
              ? "Seus dados serão analisados pelo administrador do Meu Rim. Você receberá um aviso após a aprovação."
              : "Seu cadastro foi recebido. Um nefrologista pode adicioná-lo para atender os pacientes encaminhados, ou o administrador pode liberar o acesso."}
          </p>
          <Link href="/medicos/login" className="btn-gold w-full">
            Voltar para o login
          </Link>
        </div>
      </AuthShell>
    );
  }

  const coreFields = [
    ["name", "Nome completo", "text", true],
    ["email", "E-mail", "text", true],
    ["password", "Senha", "password", true],
    ["phone", "Telefone", "tel", false],
    ["crm", "CRM", "text", true],
    ["crmState", "Estado do CRM (UF)", "text", true],
    ["cpf", "CPF", "text", false],
  ] as const;

  return (
    <AuthShell
      wide
      back={{ href: "/medicos/login", label: "Login" }}
      eyebrow="Área do médico"
      title="Criar cadastro de médico"
      subtitle="Nome, CRM, especialidade e senha. Se você é nefrologista, complete também os dados da clínica. O acesso é liberado após aprovação."
    >
      <form onSubmit={onSubmit} className="panel space-y-4" noValidate>
        {coreFields.map(([key, label, type, required]) => (
          <label key={key} className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              {label}
            </span>
            <input
              type={type}
              inputMode={key === "email" ? "email" : key === "phone" ? "tel" : key === "cpf" ? "numeric" : undefined}
              autoCapitalize={key === "email" ? "none" : undefined}
              className="input-field"
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              required={required}
              placeholder={key === "crmState" ? "Ex.: BA" : undefined}
            />
          </label>
        ))}

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            Especialidade
          </span>
          <select className="input-field" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} required>
            {DOCTOR_CADASTRO_SPECIALTIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        {form.specialty === "Outra" && (
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              Qual especialidade?
            </span>
            <input className="input-field" value={form.specialtyOther} onChange={(e) => set("specialtyOther", e.target.value)} placeholder="Ex.: Angiologia" />
          </label>
        )}

        {nephrology && (
          <>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                CNS (Cartão Nacional de Saúde)
              </span>
              <input className="input-field" value={form.cns} onChange={(e) => set("cns", e.target.value)} inputMode="numeric" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                RQE (se houver)
              </span>
              <input className="input-field" value={form.rqe} onChange={(e) => set("rqe", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Clínica / local de atendimento
              </span>
              <input className="input-field" value={form.clinic} onChange={(e) => set("clinic", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                Chave Pix (para receber)
              </span>
              <input className="input-field" value={form.pixKey} onChange={(e) => set("pixKey", e.target.value)} />
            </label>
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
          </>
        )}

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
    </AuthShell>
  );
}

export default function CadastroMedicoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CadastroMedicoForm />
    </Suspense>
  );
}
