"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COMPANY,
  OPTIONAL_COMPANY_FIELDS,
  REQUIRED_COMPANY_FIELDS,
} from "@/lib/company";

const LONG_FIELDS = new Set([
  "address",
  "cancellationPolicy",
  "suppliers",
  "storageLocation",
  "retentionByCategory",
  "documentIssuerData",
  "dpoContact",
]);

export default function AdminEmpresaPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setSettings(data.settings || {});
    setMissing(data.missing || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function set(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
    setMsg("");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json();
    setMissing(data.missing || []);
    setMsg(data.ok ? "Dados salvos." : "Não foi possível salvar.");
    setSaving(false);
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;
  }

  const allFields = [...REQUIRED_COMPANY_FIELDS.map((f) => ({ ...f, required: true })), ...OPTIONAL_COMPANY_FIELDS.map((f) => ({ ...f, required: false }))];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Dados da empresa</h1>

      <div className="panel mt-6 space-y-1 text-sm">
        <p><span className="text-[var(--text-muted)]">Razão social:</span> <strong className="text-[var(--text)]">{COMPANY.legalName}</strong></p>
        <p><span className="text-[var(--text-muted)]">Nome fantasia:</span> <strong className="text-[var(--text)]">{COMPANY.tradeName}</strong></p>
        <p><span className="text-[var(--text-muted)]">CNPJ:</span> <strong className="text-[var(--text)]">{COMPANY.cnpj}</strong></p>
      </div>

      {missing.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[var(--warn)]/40 bg-[#fff7e8] p-4 text-sm text-[#7a5a12]">
          <strong>Publicação dos documentos legais bloqueada.</strong> Preencha os campos obrigatórios pendentes:
          <span className="mt-1 block">{missing.join(" · ")}</span>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-[var(--green)]/40 bg-[#eaf8f2] p-4 text-sm text-[#1c8c70]">
          Todos os campos obrigatórios preenchidos — documentos legais podem ser publicados.
        </div>
      )}

      <div className="panel mt-4 space-y-4">
        {allFields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              {f.label}{f.required && <span className="text-[var(--danger)]"> *</span>}
            </span>
            {LONG_FIELDS.has(f.key) ? (
              <textarea className="input-field min-h-[80px]" value={settings[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <input className="input-field" value={settings[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </label>
        ))}
        {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar dados da empresa"}
        </button>
      </div>

      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Não invente dados. Preencha somente com informações reais da C.J. ATENDIMENTOS MEDICOS LTDA.
      </p>
    </div>
  );
}
