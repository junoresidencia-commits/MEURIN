"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode } from "@/components/QrCode";
import { SITE_URL, patientAccessMessage } from "@/lib/site";

export function CreatePatient({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    cns: "",
    motherName: "",
    birthdate: "",
    age: "",
    sex: "",
    phone: "",
    email: "",
    address: "",
    emergencyContact: "",
    guardianName: "",
    guardianPhone: "",
    insurance: "",
    allergies: "",
    diseases: "",
    medications: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; phone: string; email: string; cpf: string } | null>(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [dup, setDup] = useState<{ id: string; name: string; cpf?: string | null } | null>(null);
  function copyText(text: string, label: string) { navigator.clipboard?.writeText(text); setCopyMsg(`${label} copiado!`); setTimeout(() => setCopyMsg(""), 1500); }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function submit(force = false) {
    if (!form.name.trim()) { setError("Informe o nome completo."); return; }
    const ageNum = Number(String(form.age).replace(/\D/g, ""));
    const hasAge = form.age.trim() !== "" && ageNum > 0 && ageNum < 130;
    if (!form.birthdate && !hasAge) { setError("Informe a data de nascimento OU a idade (necessária para calcular TFGe)."); return; }
    if (!form.sex) { setError("Selecione o sexo (feminino ou masculino)."); return; }
    if (!form.address.trim()) { setError("Informe a cidade / região."); return; }
    setSaving(true);
    setError("");
    if (force) setDup(null);
    // Sem data de nascimento? Deriva uma data aproximada a partir da idade (1º de janeiro
    // do ano). Serve para os cálculos; o médico pode corrigir a data exata depois.
    const birthdate = form.birthdate || (hasAge ? `${new Date().getFullYear() - ageNum}-01-01` : "");
    const { age: _age, ...rest } = form;
    void _age;
    try {
      const res = await fetch("/api/doctor/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, birthdate, force }),
      });
      const data = await res.json();
      if (data.possibleDuplicate) {
        setDup(data.existing);
        setSaving(false);
        return;
      }
      if (res.status === 409) {
        throw new Error(
          data.existingIsMine
            ? "Você já tem um paciente com este CPF."
            : "Já existe um paciente com este CPF em outro médico. Solicite vínculo."
        );
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível criar.");
      setDone({ name: form.name, phone: form.phone, email: form.email, cpf: form.cpf });
      if (data.linkedExisting) setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  function accessMessage() { return patientAccessMessage(done!.name); }
  function inviteLink() {
    const digits = done!.phone.replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : `55${digits}`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(accessMessage())}`;
  }

  if (done) {
    const hasPhone = done.phone.replace(/\D/g, "").length >= 10;
    return (
      <div className="panel mt-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--green)]">Paciente cadastrado ✅</p>
        {done.cpf.replace(/\D/g, "") ? (
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-sm text-[var(--text-soft)]">
            <p className="font-semibold text-[var(--text)]">Acesso do paciente</p>
            <p>Site: <b>{SITE_URL}/</b></p>
            <p>Login (CPF): <b>{done.cpf.replace(/\D/g, "")}</b></p>
            <p>Senha provisória: <b>123456</b> — no 1º acesso o paciente cria uma senha pessoal.</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text-muted)]">
            Sem CPF cadastrado: informe o CPF para habilitar o login do paciente com senha.
          </p>
        )}

        <div className="rounded-2xl border border-[var(--border)] p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Mensagem de acesso</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-[var(--text-soft)]">{accessMessage()}</pre>
        </div>

        {!hasPhone && (
          <p className="rounded-xl border border-[var(--warn)]/30 bg-[#fff7e8] px-3 py-2 text-xs text-[#7a5a12]">
            Sem telefone com WhatsApp — não é possível enviar automaticamente. Use “Copiar mensagem” e envie ao paciente.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {hasPhone && (
            <>
              <a href={inviteLink()} target="_blank" rel="noopener noreferrer" className="btn-gold">Enviar acesso pelo WhatsApp</a>
              <a href={inviteLink()} target="_blank" rel="noopener noreferrer" className="btn-ghost">Reenviar acesso</a>
            </>
          )}
          <button type="button" className="btn-ghost" onClick={() => copyText(accessMessage(), "Mensagem")}>Copiar mensagem</button>
          <button type="button" className="btn-ghost" onClick={() => copyText(`${SITE_URL}/`, "Link")}>Copiar link</button>
        </div>
        {copyMsg && <p className="text-xs font-semibold text-[var(--green,#0d9488)]">{copyMsg}</p>}

        <div className="pt-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">QR Code de acesso</p>
          <p className="mb-2 text-xs text-[var(--text-muted)]">Aponte a câmera para {SITE_URL}/ — sem dados pessoais.</p>
          <QrCode value={`${SITE_URL}/`} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={() => { setDone(null); setForm((f) => ({ ...f, name: "", cpf: "", phone: "", email: "" })); }}>Cadastrar outro</button>
          <button type="button" className="btn-ghost" onClick={onCreated}>Concluir</button>
        </div>
      </div>
    );
  }

  const fields = [
    ["name", "Nome completo", "text", true],
    ["cpf", "CPF", "text", false],
    ["birthdate", "Data de nascimento (ou informe a idade)", "date", false],
    ["age", "Idade (anos) — se não tiver a data", "number", false],
    ["sex", "Sexo", "select", true],
    ["address", "Cidade / região", "text", true],
    ["cns", "CNS (Cartão SUS)", "text", false],
    ["motherName", "Nome da mãe", "text", false],
    ["phone", "Telefone", "tel", false],
    ["email", "E-mail", "email", false],
    ["emergencyContact", "Contato de emergência", "text", false],
    ["guardianName", "Responsável legal (se menor)", "text", false],
    ["guardianPhone", "Telefone do responsável", "tel", false],
    ["insurance", "Convênio / particular", "text", false],
  ] as const;

  const longFields = [
    ["allergies", "Alergias"],
    ["diseases", "Doenças"],
    ["medications", "Medicamentos em uso"],
    ["notes", "Observações"],
  ] as const;

  return (
    <div className="panel mt-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Novo paciente</p>
      <p className="text-xs text-[var(--text-muted)]">Obrigatórios: nome, sexo, cidade e <b>data de nascimento OU idade</b>. Sem a data, informe a idade — a data exata pode ser preenchida depois.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label, type, required]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}{required ? <span className="text-[var(--danger)]"> *</span> : null}</span>
            {type === "select" ? (
              <select className="input-field" value={form[k]} onChange={(e) => set(k, e.target.value)}>
                <option value="">Selecione</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
              </select>
            ) : (
              <input type={type} className="input-field" value={form[k]} onChange={(e) => set(k, e.target.value)} />
            )}
          </label>
        ))}
      </div>
      {longFields.map(([k, label]) => (
        <label key={k} className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
          <textarea className="input-field min-h-[60px]" value={form[k]} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
      {dup && (
        <div className="rounded-xl border border-[var(--warn)]/40 bg-[#fff7e8] p-3 text-sm text-[#7a5a12]">
          <p className="font-semibold">Já existe um paciente com nome parecido: {dup.name}{dup.cpf ? ` (CPF ${dup.cpf})` : ""}.</p>
          <p className="mt-1">É a mesma pessoa? Abra o cadastro existente. Se for outra pessoa, crie mesmo assim.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/medicos/paciente/${encodeURIComponent(dup.id)}`} className="btn-ghost text-sm">Abrir existente</Link>
            <button type="button" className="btn-gold text-sm" onClick={() => submit(true)} disabled={saving}>Criar mesmo assim</button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setDup(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="button" className="btn-gold" onClick={() => submit(false)} disabled={saving || !form.name.trim()}>
        {saving ? "Criando…" : "Criar paciente e abrir prontuário"}
      </button>
    </div>
  );
}
