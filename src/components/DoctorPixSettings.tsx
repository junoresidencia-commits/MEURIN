"use client";

import { useEffect, useState } from "react";

type PixState = {
  keyType?: string;
  key?: string;
  holderName?: string;
  holderDoc?: string;
  bank?: string;
  city?: string;
};

const KEY_TYPES: { value: string; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

/** Perfil Pix do médico (recebimento direto) + copia e cola (BR Code) para o paciente. */
export function DoctorPixSettings() {
  const [pix, setPix] = useState<PixState>({});
  const [brCode, setBrCode] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/doctor/pix")
      .then((r) => r.json())
      .then((d) => {
        setPix(d.pix || {});
        setBrCode(d.brCode || "");
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function set<K extends keyof PixState>(k: K, v: string) {
    setPix((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/doctor/pix", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pix }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setBrCode(data.brCode || "");
      setMsg("Chave Pix salva.");
    } else {
      setMsg(data.error || "Não foi possível salvar.");
    }
  }

  function copy() {
    if (!brCode) return;
    navigator.clipboard?.writeText(brCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="panel mt-4 space-y-3">
      <p className="text-sm text-[var(--text-soft)]">
        Cadastre a sua chave Pix para receber consultas diretamente. O paciente poderá copiar o código Pix e pagar pelo próprio banco.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo de chave</span>
          <select className="input-field" value={pix.keyType || ""} onChange={(e) => set("keyType", e.target.value)} disabled={!loaded}>
            <option value="">Selecione</option>
            {KEY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Chave Pix</span>
          <input className="input-field" value={pix.key || ""} onChange={(e) => set("key", e.target.value)} placeholder="chave (CPF/CNPJ/e-mail/telefone/aleatória)" disabled={!loaded} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome do titular</span>
          <input className="input-field" value={pix.holderName || ""} onChange={(e) => set("holderName", e.target.value)} placeholder="Nome de quem recebe" disabled={!loaded} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF/CNPJ do titular</span>
          <input className="input-field" value={pix.holderDoc || ""} onChange={(e) => set("holderDoc", e.target.value)} placeholder="Documento do titular" disabled={!loaded} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Banco / instituição</span>
          <input className="input-field" value={pix.bank || ""} onChange={(e) => set("bank", e.target.value)} placeholder="Ex.: Nubank, Itaú…" disabled={!loaded} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade do recebedor</span>
          <input className="input-field" value={pix.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="Cidade (para o código Pix)" disabled={!loaded} />
        </label>
      </div>
      <button type="button" className="btn-gold" onClick={save} disabled={saving || !loaded}>{saving ? "Salvando…" : "Salvar chave Pix"}</button>
      {msg && <p className="text-sm font-semibold text-[var(--gold)]">{msg}</p>}

      {brCode && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--gold-soft)]/40 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Pix copia e cola (BR Code)</p>
          <p className="mt-1 break-all font-mono text-[12px] text-[var(--text-soft)]">{brCode}</p>
          <button type="button" className="btn-ghost mt-2 text-sm" onClick={copy}>{copied ? "Copiado!" : "Copiar código Pix"}</button>
        </div>
      )}
    </div>
  );
}
