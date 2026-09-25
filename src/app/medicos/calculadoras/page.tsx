"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { CalcResultView } from "@/components/calculators/CalcResultView";
import { SECTION_LABEL, type ToolMeta } from "@/lib/calculators/catalog";
import { MANUAL_FIELDS } from "@/lib/calculators/manual-fields";
import type { CalcResult, CalcSection, ManualOverrides } from "@/lib/calculators/types";

const ORDER: CalcSection[] = ["rim", "cardiovascular", "medicamentos", "geriatria", "suporte", "hemodialise", "eletrolitos"];

export default function CalculadorasPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [toolId, setToolId] = useState<string>("ckd_epi_cr_2021");
  const [form, setForm] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CalcResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch("/api/calculators").then((r) => r.json()).then((x) => setTools(x.tools || [])).catch(() => {});
    });
  }, [router]);

  const tool = tools.find((t) => t.id === toolId);
  const fields = MANUAL_FIELDS[toolId] || [];
  const grouped = useMemo(() => {
    return ORDER.map((s) => ({ s, items: tools.filter((t) => t.section === s) })).filter((g) => g.items.length);
  }, [tools]);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setResult(null);
    const overrides: ManualOverrides = {};
    for (const f of fields) {
      const raw = form[f.key];
      if (raw == null || raw === "") continue;
      if (f.type === "bool") overrides[f.key] = raw === "sim" || raw === "true";
      else if (f.type === "number") overrides[f.key] = Number(String(raw).replace(",", "."));
      else overrides[f.key] = raw;
    }
    try {
      const r = await fetch("/api/calculators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, overrides }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível calcular.");
      setResult(d.result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]">Apoio clínico</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Calculadoras & Risco</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Digite os dados e calcule. Nada é inventado se faltar valor. No prontuário, a aba Riscos preenche o que já existe.
            A decisão final é sempre do médico.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/medicos/pacientes" className="font-semibold text-[var(--gold)]">Abrir um paciente → Riscos & Cálculos</Link>
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
            <nav className="space-y-4">
              {grouped.map((g) => (
                <div key={g.s}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">{SECTION_LABEL[g.s]}</p>
                  <div className="mt-1 space-y-1">
                    {g.items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setToolId(t.id); setResult(null); setForm({}); }}
                        className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                          toolId === t.id ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-[var(--text-soft)] hover:bg-[var(--gold-soft)]"
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div>
              {tool && (
                <div className="panel mb-4">
                  <h2 className="font-display text-xl font-extrabold">{tool.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{tool.population}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Versão {tool.version} · {tool.source}</p>
                  {tool.licenseNote && <p className="mt-2 text-sm text-amber-800">{tool.licenseNote}</p>}
                  {tool.officialUrl && (
                    <a href={tool.officialUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[var(--gold)]">
                      Abrir instrumento oficial →
                    </a>
                  )}
                </div>
              )}

              <form className="panel space-y-3" onSubmit={calculate}>
                {fields.map((f) => (
                  <label key={f.key} className="block text-sm font-semibold text-[var(--text)]">
                    {f.label}
                    {f.type === "select" ? (
                      <select
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-normal"
                        value={form[f.key] || ""}
                        onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      >
                        <option value="">—</option>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === "bool" ? (
                      <select
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-normal"
                        value={form[f.key] || ""}
                        onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      >
                        <option value="">— não informado —</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    ) : (
                      <input
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-normal"
                        value={form[f.key] || ""}
                        onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
                {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
                <button type="submit" className="btn-gold" disabled={busy}>{busy ? "Calculando…" : "Calcular"}</button>
              </form>

              {result && (
                <div className="mt-4">
                  <CalcResultView result={result} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
