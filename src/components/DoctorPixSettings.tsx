"use client";

import { useEffect, useState } from "react";
import { PixQrPanel } from "@/components/PixQrPanel";

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

const PLACEHOLDERS: Record<string, string> = {
  cpf: "000.000.000-00 ou 00000000000",
  cnpj: "00.000.000/0000-00",
  email: "email@dominio.com",
  telefone: "(77) 99999-9999 ou +55 77 99999-9999",
  aleatoria: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
};

export function DoctorPixSettings() {
  const [pix, setPix] = useState<PixState>({});
  const [brCode, setBrCode] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

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
    setErr("");
    setMsg("");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/doctor/pix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pix }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Não foi possível salvar sua chave PIX. Verifique os dados informados.");
        return;
      }
      setPix(data.pix || pix);
      setBrCode(data.brCode || "");
      setMsg(data.message || "Chave PIX salva com sucesso.");
    } catch (e) {
      console.error("[pix] ui médico", e);
      setErr("Não foi possível salvar sua chave PIX. Verifique os dados informados.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pix.key && !brCode) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/doctor/pix", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Não foi possível excluir a chave PIX.");
        return;
      }
      setPix({});
      setBrCode("");
      setMsg(data.message || "Chave PIX removida.");
    } catch (e) {
      console.error("[pix] ui excluir", e);
      setErr("Não foi possível excluir a chave PIX.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel mt-4 space-y-3">
      <p className="text-sm text-[var(--text-soft)]">
        Cadastre a sua chave PIX para receber consultas, procedimentos e cobranças diretamente.
        O valor cai 100% nessa chave. A porcentagem da plataforma (se houver) entra no relatório — o PIX em si não é dividido automaticamente.
        Quando o pagamento for do profissional, o sistema usa esta chave, nunca o PIX da clínica.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo de chave PIX</span>
          <select className="input-field" value={pix.keyType || ""} onChange={(e) => set("keyType", e.target.value)} disabled={!loaded}>
            <option value="">Selecione</option>
            {KEY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Chave PIX</span>
          <input
            className="input-field"
            value={pix.key || ""}
            onChange={(e) => set("key", e.target.value)}
            placeholder={PLACEHOLDERS[pix.keyType || ""] || "Informe a chave"}
            disabled={!loaded}
          />
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
          <input className="input-field" value={pix.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="Cidade (para o código PIX)" disabled={!loaded} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-gold" onClick={save} disabled={saving || !loaded}>
          {saving ? "Salvando…" : pix.key ? "Salvar / substituir chave PIX" : "Salvar chave PIX"}
        </button>
        {(pix.key || brCode) && (
          <button type="button" className="btn-ghost text-sm" onClick={remove} disabled={saving}>
            Excluir chave
          </button>
        )}
      </div>
      {msg && <p className="text-sm font-semibold text-[var(--green,#0d9488)]">{msg}</p>}
      {err && <p className="text-sm font-semibold text-[var(--danger,#b91c1c)]">{err}</p>}
      <PixQrPanel brCode={brCode} pixKey={pix.key} />
    </div>
  );
}
