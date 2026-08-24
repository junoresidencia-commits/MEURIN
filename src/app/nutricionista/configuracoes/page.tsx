"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfilePhotoUploader } from "@/components/ProfilePhotoUploader";

const KEY_TYPES = [
  { v: "cpf", l: "CPF" }, { v: "cnpj", l: "CNPJ" }, { v: "email", l: "E-mail" }, { v: "telefone", l: "Telefone" }, { v: "aleatoria", l: "Aleatória" },
];

export default function NutriConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState("");
  const [returnPrice, setReturnPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [pix, setPix] = useState({ keyType: "cpf", key: "", holderName: "", holderDoc: "", bank: "", city: "" });
  const [commission, setCommission] = useState<number | null>(null);
  const [payout, setPayout] = useState("active");
  const [brcode, setBrcode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/nutricionista/settings").then(async (r) => {
      if (r.status === 401) { router.replace("/nutricionista/login"); return; }
      const d = await r.json();
      setPrice(d.consultationPriceCents != null ? String(d.consultationPriceCents / 100) : "");
      setReturnPrice(d.returnPriceCents != null ? String(d.returnPriceCents / 100) : "");
      setPhone(d.phone || "");
      if (d.pixProfile) setPix({ keyType: d.pixProfile.keyType || "cpf", key: d.pixProfile.key || "", holderName: d.pixProfile.holderName || "", holderDoc: d.pixProfile.holderDoc || "", bank: d.pixProfile.bank || "", city: d.pixProfile.city || "" });
      setCommission(d.commissionPercent ?? null);
      setPayout(d.payoutStatus || "active");
      setLoading(false);
    });
  }, [router]);

  async function save() {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/nutricionista/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationPrice: price, returnPrice, pixProfile: pix, phone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      setBrcode(d.brcode || null);
      setMsg("Configurações salvas.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/nutricionista/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">Meu perfil e recebimentos</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Atualize sua foto, telefone (os pacientes usam para combinar Pix e consulta), o valor da consulta/retorno e a chave Pix. O plano alimentar só é liberado ao paciente depois que você confirmar o pagamento.</p>

      <div className="mt-5">
        <ProfilePhotoUploader endpoint="/api/nutricionista/photo" label="Foto de perfil" hint="Sua foto aparece na sua área e para a equipe." fallback="Nu" />
      </div>

      <section className="panel mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone / WhatsApp (visível ao paciente)</span><input className="input-field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(71) 99999-0000" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor da consulta (R$)</span><input className="input-field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor do retorno (R$)</span><input className="input-field" inputMode="decimal" value={returnPrice} onChange={(e) => setReturnPrice(e.target.value)} /></label>
      </section>

      <section className="panel mt-4">
        <p className="text-sm font-semibold text-[var(--text)]">Chave Pix (recebimento direto)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo de chave</span>
            <select className="input-field" value={pix.keyType} onChange={(e) => setPix({ ...pix, keyType: e.target.value })}>
              {KEY_TYPES.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Chave</span><input className="input-field" value={pix.key} onChange={(e) => setPix({ ...pix, key: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome do titular</span><input className="input-field" value={pix.holderName} onChange={(e) => setPix({ ...pix, holderName: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF/CNPJ do titular</span><input className="input-field" value={pix.holderDoc} onChange={(e) => setPix({ ...pix, holderDoc: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Banco</span><input className="input-field" value={pix.bank} onChange={(e) => setPix({ ...pix, bank: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade</span><input className="input-field" value={pix.city} onChange={(e) => setPix({ ...pix, city: e.target.value })} /></label>
        </div>
      </section>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        {msg && <span className="text-sm font-semibold text-[var(--text-soft)]">{msg}</span>}
      </div>
      {brcode && (
        <div className="panel mt-4">
          <p className="text-xs font-semibold text-[var(--text-muted)]">Pix copia-e-cola (teste)</p>
          <p className="mt-1 break-all rounded-lg bg-[var(--bg)] p-2 text-xs text-[var(--text-soft)]">{brcode}</p>
        </div>
      )}
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Comissão da plataforma: {commission != null ? `${commission}%` : "definida pelo administrador"} · Recebimento: {payout === "active" ? "liberado" : payout === "pending" ? "em análise" : "bloqueado"}.
      </p>
    </div>
  );
}
