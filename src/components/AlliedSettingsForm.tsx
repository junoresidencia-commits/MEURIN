"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AlliedRole } from "@/lib/allied-types";
import { ROLE_META } from "@/lib/allied-types";
import { PlatformFeePayPanel } from "@/components/PlatformFeePayPanel";
import { PixQrPanel } from "@/components/PixQrPanel";
import { ProfilePhotoUploader } from "@/components/ProfilePhotoUploader";

const KEY_TYPES = [
  { v: "cpf", l: "CPF" },
  { v: "cnpj", l: "CNPJ" },
  { v: "email", l: "E-mail" },
  { v: "telefone", l: "Telefone" },
  { v: "aleatoria", l: "Aleatória" },
];

export function AlliedSettingsForm({ role }: { role: AlliedRole }) {
  const router = useRouter();
  const meta = ROLE_META[role];
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    registry: "",
    uf: "",
    city: "",
    specialty: "",
    bio: "",
  });
  const [price, setPrice] = useState("");
  const [returnPrice, setReturnPrice] = useState("");
  const [pix, setPix] = useState({
    keyType: "cpf",
    key: "",
    holderName: "",
    holderDoc: "",
    bank: "",
    city: "",
  });
  const [brcode, setBrcode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/allied/settings").then(async (r) => {
      if (r.status === 401) {
        router.replace(`${meta.path}/login`);
        return;
      }
      const d = await r.json();
      setProfile({
        name: d.name || "",
        phone: d.phone || "",
        email: d.email || "",
        registry: d.registry || "",
        uf: d.uf || "",
        city: d.city || "",
        specialty: d.specialty || "",
        bio: d.bio || "",
      });
      setPrice(d.consultationPriceCents != null ? String(d.consultationPriceCents / 100) : "");
      setReturnPrice(d.returnPriceCents != null ? String(d.returnPriceCents / 100) : "");
      if (d.pixProfile) {
        setPix({
          keyType: d.pixProfile.keyType || "cpf",
          key: d.pixProfile.key || "",
          holderName: d.pixProfile.holderName || "",
          holderDoc: d.pixProfile.holderDoc || "",
          bank: d.pixProfile.bank || "",
          city: d.pixProfile.city || "",
        });
      }
      setLoading(false);
    });
  }, [meta.path, router]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/allied/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          consultationPrice: price,
          returnPrice,
          pixProfile: pix,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar o perfil.");
      setBrcode(d.brcode || null);
      setMsg("Perfil e recebimentos salvos.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href={`${meta.path}/painel`} className="text-sm font-semibold text-[var(--gold)]">
        ← Painel
      </Link>
      <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">Meu perfil e recebimentos</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Foto, dados profissionais e a sua chave Pix. A foto aparece na busca da rede, nos encaminhamentos e no seu painel.
      </p>

      <div className="mt-5">
        <ProfilePhotoUploader
          endpoint="/api/allied/photo"
          label="Foto de perfil"
          hint="Toque em Adicionar foto para enviar PNG, JPG ou WEBP. Troque ou remova quando quiser."
          fallback={profile.name || meta.label}
        />
      </div>

      <section className="panel mt-4 grid gap-3 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm font-semibold text-[var(--text)]">Dados profissionais</p>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo</span>
          <input className="input-field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span>
          <input className="input-field" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone / WhatsApp</span>
          <input className="input-field" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{meta.registry}</span>
          <input className="input-field" value={profile.registry} onChange={(e) => setProfile({ ...profile, registry: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">UF</span>
          <input className="input-field" value={profile.uf} onChange={(e) => setProfile({ ...profile, uf: e.target.value })} placeholder="BA" maxLength={2} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade</span>
          <input className="input-field" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span>
          <input className="input-field" value={profile.specialty} onChange={(e) => setProfile({ ...profile, specialty: e.target.value })} placeholder={meta.label} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Bio pública</span>
          <textarea className="input-field min-h-[88px]" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Como você atende, abordagem, público." />
        </label>
      </section>

      <section className="panel mt-4 grid gap-3 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm font-semibold text-[var(--text)]">Valores</p>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor da consulta (R$)</span>
          <input className="input-field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0 = consulta gratuita" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor do retorno (R$)</span>
          <input className="input-field" inputMode="decimal" value={returnPrice} onChange={(e) => setReturnPrice(e.target.value)} placeholder="0 = retorno grátis" />
        </label>
      </section>

      <section className="panel mt-4">
        <p className="text-sm font-semibold text-[var(--text)]">Chave Pix (recebimento direto)</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">O paciente paga na sua chave. Sem Pix cadastrado, a consulta online só pode ser gratuita.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo de chave</span>
            <select className="input-field" value={pix.keyType} onChange={(e) => setPix({ ...pix, keyType: e.target.value })}>
              {KEY_TYPES.map((k) => (
                <option key={k.v} value={k.v}>{k.l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Chave</span>
            <input className="input-field" value={pix.key} onChange={(e) => setPix({ ...pix, key: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome do titular</span>
            <input className="input-field" value={pix.holderName} onChange={(e) => setPix({ ...pix, holderName: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF/CNPJ do titular</span>
            <input className="input-field" value={pix.holderDoc} onChange={(e) => setPix({ ...pix, holderDoc: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Banco</span>
            <input className="input-field" value={pix.bank} onChange={(e) => setPix({ ...pix, bank: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade</span>
            <input className="input-field" value={pix.city} onChange={(e) => setPix({ ...pix, city: e.target.value })} />
          </label>
        </div>
      </section>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-gold" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar perfil"}
        </button>
        {msg && <span className="text-sm font-semibold text-[var(--text-soft)]">{msg}</span>}
      </div>
      {brcode && (
        <div className="panel mt-4">
          <PixQrPanel brCode={brcode} pixKey={pix.key} />
        </div>
      )}

      <PlatformFeePayPanel endpoint="/api/allied/platform-fee" />
    </div>
  );
}
