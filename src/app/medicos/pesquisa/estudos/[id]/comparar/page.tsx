"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Option = { key: string; label: string; values: string[] };
type TestResult = { test: string; statistic: number; df?: number; p: number; rationale: string };
type NumRow = { key: string; label: string; unit?: string; kind: "num"; a: { n: number; mean: number; sd: number; median: number; q1: number; q3: number } | null; b: { n: number; mean: number; sd: number; median: number; q1: number; q3: number } | null; test: TestResult | null };
type CatRow = { key: string; label: string; kind: "cat"; categories: string[]; a: Record<string, number>; b: Record<string, number>; test: TestResult | null };
type Row = NumRow | CatRow;
type CompareResult = { groupVar: string; groupLabel: string; valueA: string; valueB: string; nA: number; nB: number; rows: Row[] };

const num = (x: number) => String(x).replace(".", ",");
const fmtP = (p: number) => (!Number.isFinite(p) ? "—" : p < 0.001 ? "< 0,001" : num(Math.round(p * 1000) / 1000));

export default function CompararPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [ready, setReady] = useState(false);
  const [n, setN] = useState(0);
  const [options, setOptions] = useState<Option[]>([]);
  const [groupVar, setGroupVar] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch(`/api/pesquisa/studies/${id}/compare`).then((r) => r.json()).then((x) => {
        setN(x.n || 0);
        setOptions(x.options || []);
        if (x.options?.[0]) {
          setGroupVar(x.options[0].key);
          setA(x.options[0].values[0] || "");
          setB(x.options[0].values[1] || "");
        }
      });
    });
  }, [router, id]);

  const opt = options.find((o) => o.key === groupVar);

  async function run() {
    if (!groupVar || !a || !b || a === b) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ groupVar, a, b });
      const res = await fetch(`/api/pesquisa/studies/${id}/compare?${q.toString()}`);
      const data = await res.json();
      setResult(data.result || null);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]"><Link href={`/medicos/pesquisa/estudos/${id}`} className="hover:underline">Estudo</Link> › Comparar grupos</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Comparação entre grupos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{n} paciente(s) na coorte. O teste é sugerido conforme o tipo da variável, o tamanho da amostra e a simetria; o p-valor é calculado a partir dos dados reais.</p>

          {options.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--text-muted)]">Nenhuma variável categórica com dois grupos disponível nesta coorte. Cadastre o perfil clínico (ex.: DM, DRC) e recalcule.</p>
          ) : (
            <div className="panel mt-6 space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Agrupar por</span>
                  <select className="input-field" value={groupVar} onChange={(e) => { setGroupVar(e.target.value); const o = options.find((x) => x.key === e.target.value); setA(o?.values[0] || ""); setB(o?.values[1] || ""); setResult(null); }}>
                    {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Grupo A</span>
                  <select className="input-field" value={a} onChange={(e) => setA(e.target.value)}>
                    {opt?.values.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Grupo B</span>
                  <select className="input-field" value={b} onChange={(e) => setB(e.target.value)}>
                    {opt?.values.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="btn-gold" onClick={run} disabled={loading || a === b}>{loading ? "Calculando…" : "Comparar"}</button>
            </div>
          )}

          {result && (
            <div className="panel mt-4 overflow-x-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                {result.groupLabel}: {result.valueA} (n={result.nA}) vs {result.valueB} (n={result.nB})
              </p>
              <table className="mt-2 w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--text-muted)]">
                    <th className="py-1.5">Variável</th>
                    <th className="py-1.5">{result.valueA}</th>
                    <th className="py-1.5">{result.valueB}</th>
                    <th className="py-1.5">Teste</th>
                    <th className="py-1.5 text-right">p</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.key} className="border-b border-[var(--border)] align-top">
                      <td className="py-1.5 pr-2 text-[var(--text-soft)]">{r.label}{r.kind === "num" && r.unit ? ` (${r.unit})` : ""}</td>
                      {r.kind === "num" ? (
                        <>
                          <td className="py-1.5 pr-2 text-[var(--text)]">{r.a ? `${num(r.a.mean)} ± ${num(r.a.sd)}` : "—"}</td>
                          <td className="py-1.5 pr-2 text-[var(--text)]">{r.b ? `${num(r.b.mean)} ± ${num(r.b.sd)}` : "—"}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 pr-2 text-[var(--text)]">{r.categories.map((c) => `${c}: ${r.a[c] || 0}`).join("; ")}</td>
                          <td className="py-1.5 pr-2 text-[var(--text)]">{r.categories.map((c) => `${c}: ${r.b[c] || 0}`).join("; ")}</td>
                        </>
                      )}
                      <td className="py-1.5 pr-2 text-xs text-[var(--text-muted)]">{r.test ? r.test.test : "—"}</td>
                      <td className="py-1.5 text-right font-semibold text-[var(--text)]">{r.test ? fmtP(r.test.p) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 space-y-1">
                {result.rows.filter((r) => r.test).map((r) => (
                  <p key={r.key} className="text-xs text-[var(--text-muted)]"><b className="text-[var(--text-soft)]">{r.label}:</b> {r.test!.rationale}</p>
                ))}
              </div>
              <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--gold-soft)]/40 px-3 py-2 text-xs text-[var(--text-muted)]">
                Análise exploratória. p-valores não corrigidos para múltiplas comparações; interprete com cautela e confirme os pressupostos. Não representa relação causal.
              </p>
            </div>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
