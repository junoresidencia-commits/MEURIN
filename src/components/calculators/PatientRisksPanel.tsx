"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { encodePatientParam } from "@/lib/user-errors";
import { SECTION_LABEL } from "@/lib/calculators/catalog";
import type { CalcResult, CalcSection } from "@/lib/calculators/types";
import { CalcResultView } from "./CalcResultView";

type Counts = { updated: number; needData: number; notApplicable: number; needClinical: number };
type Assessment = { id: string; toolId: string; payload: Record<string, unknown>; assessedBy?: string | null; context?: string | null; note?: string | null; createdAt: string };
type Decision = { id: string; item: string; rule: string; decision: string; note?: string | null; createdAt: string };

const ORDER: CalcSection[] = ["rim", "cardiovascular", "medicamentos", "geriatria", "suporte", "hemodialise", "eletrolitos"];

function pick(results: CalcResult[], id: string) {
  return results.find((r) => r.toolId === id);
}
function val(r: CalcResult | undefined, label: string) {
  return r?.values.find((v) => v.label === label)?.value;
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel !py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{title}</p>
      <div className="mt-1 space-y-0.5 text-sm text-[var(--text)]">{children}</div>
    </div>
  );
}

export function PatientRisksPanel({ emailParam }: { emailParam: string }) {
  const [results, setResults] = useState<CalcResult[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ toolId: string; items: { headline: string; createdAt: string }[] } | null>(null);
  const [doctorName, setDoctorName] = useState("");

  const url = `/api/doctor/patients/${encodePatientParam(emailParam)}/calculators`;

  const load = useCallback(async () => {
    setErr("");
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Não foi possível carregar os cálculos.");
    setResults(d.results || []);
    setCounts(d.counts || null);
    setAssessments(d.assessments || []);
    setDecisions(d.decisions || []);
  }, [url]);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setDoctorName(d?.doctor?.name || "")).catch(() => {});
    load().catch((e) => setErr(e instanceof Error ? e.message : "Erro")).finally(() => setLoading(false));
  }, [load]);

  async function refresh() {
    setBusy(true);
    setFlash("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao atualizar.");
      setResults(d.results || []);
      setCounts(d.counts || null);
      const c = d.counts as Counts;
      setFlash(`${c.updated} cálculos atualizados · ${c.needData} precisam de dados · ${c.notApplicable} não são aplicáveis${c.needClinical ? ` · ${c.needClinical} precisam de avaliação clínica` : ""}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function record(toolId: string, payload: Record<string, string | number | boolean | null>, extra?: { context?: string; note?: string }) {
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record", toolId, payload, assessedBy: doctorName, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível registrar.");
      await load();
      setFlash("Registro salvo. O histórico não foi sobrescrito.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function decide(item: string, rule: string, decision: string) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decide", toolId: "geriatric_med_review", item, rule, decision }),
    });
    await load();
  }

  async function showHistory(toolId: string) {
    const r = await fetch(`${url}?history=1&toolId=${encodeURIComponent(toolId)}`);
    const d = await r.json();
    const items = [
      ...(d.history || []).map((h: { headline: string; createdAt: string }) => ({ headline: h.headline, createdAt: h.createdAt })),
      ...(d.assessments || []).map((a: Assessment) => ({ headline: `${a.toolId} registrado`, createdAt: a.createdAt })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setHistory({ toolId, items });
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando riscos e cálculos…</p>;
  if (err) return <p className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-[var(--danger)]">{err}</p>;

  const cr = pick(results, "ckd_epi_cr_2021");
  const ga = pick(results, "kdigo_ga");
  const kfre = pick(results, "kfre_4var");
  const prevent = pick(results, "prevent");
  const renal = pick(results, "renal_dose");
  const geri = pick(results, "geriatric_med_review");
  const cfs = pick(results, "cfs");
  const spict = pick(results, "spict");
  const necpal = pick(results, "necpal");
  const ktv = pick(results, "ktv_daugirdas");
  const urr = pick(results, "urr");

  const autoOk = results.filter((r) => r.status === "ok" || r.status === "recorded").length;
  const need = results.filter((r) => r.status === "missing" || r.status === "needs_clinical").length;

  const bySection = ORDER.map((s) => ({ s, items: results.filter((r) => r.section === s) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Apoio à decisão</p>
          <h2 className="font-display text-2xl font-extrabold text-[var(--text)]">Riscos & Cálculos</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
            Usa dados já autorizados do prontuário. Não inventa valor faltante. O médico decide.
          </p>
        </div>
        <button type="button" className="btn-gold" disabled={busy} onClick={refresh}>
          {busy ? "Atualizando…" : "Atualizar cálculos"}
        </button>
      </div>

      <p className="text-sm font-semibold text-[var(--text)]">
        Disponíveis automaticamente: {autoOk} · Precisam de dados adicionais: {need}
      </p>
      {flash && <p className="rounded-2xl bg-[var(--gold-soft)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">{flash}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard title="Renal">
          <p>TFG: {cr?.status === "ok" ? val(cr, "TFGe") || cr.headline : cr?.headline || "—"}</p>
          <p>{ga?.headline || "G + A: incompleto"}</p>
          <p>KFRE 2a / 5a: {kfre?.status === "ok" ? "disponível" : kfre?.status === "not_applicable" ? "não aplicável" : kfre?.missing.includes("ACR") ? "falta ACR" : kfre?.headline || "—"}</p>
        </SummaryCard>
        <SummaryCard title="Cardiovascular">
          <p>PREVENT: {prevent?.status === "ok" ? "disponível" : prevent?.status === "not_applicable" ? "não aplicável" : prevent?.missing[0] ? `falta ${prevent.missing[0]}` : prevent?.headline}</p>
        </SummaryCard>
        <SummaryCard title="Medicações">
          <p>{renal?.headline || "—"}</p>
          <p>{geri?.headline || "—"}</p>
        </SummaryCard>
        <SummaryCard title="Geriatria">
          <p>{cfs?.status === "recorded" ? cfs.headline : "CFS: ainda não avaliada"}</p>
          <p className="text-[var(--text-muted)]">Fragilidade ≠ prognóstico automático.</p>
        </SummaryCard>
        <SummaryCard title="Cuidados de suporte">
          <p>SPICT: {spict?.headline}</p>
          <p>NECPAL: {necpal?.headline}</p>
        </SummaryCard>
        <SummaryCard title="Diálise">
          <p>Kt/V: {ktv?.status === "ok" ? val(ktv, "Kt/V") : ktv?.status === "missing" ? "faltam dados da sessão" : "—"}</p>
          <p>URR: {urr?.status === "ok" ? `${val(urr, "URR")}%` : urr?.status === "missing" ? "faltam ureias" : "—"}</p>
        </SummaryCard>
      </div>

      <ClinicalForms onRecord={record} busy={busy} doctorName={doctorName} />

      {bySection.map(({ s, items }) => (
        <section key={s}>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{SECTION_LABEL[s]}</p>
          <div className="mt-2 space-y-2">
            {items.map((r) => (
              <div key={r.toolId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left"
                  onClick={() => setOpenId((v) => (v === r.toolId ? null : r.toolId))}
                >
                  <span>
                    <span className="font-bold text-[var(--text)]">{r.title}</span>
                    <span className="mt-0.5 block text-sm text-[var(--text-muted)]">{r.headline}</span>
                  </span>
                  <span className="text-xs font-bold uppercase text-[var(--gold)]">{r.status}</span>
                </button>
                {openId === r.toolId && (
                  <div className="mt-2 space-y-2">
                    <CalcResultView result={r} />
                    {r.toolId === "geriatric_med_review" && r.values.length > 0 && r.status === "ok" && (
                      <div className="panel !py-3 text-sm">
                        <p className="font-semibold">Decisão do médico (não altera a prescrição)</p>
                        {r.values.filter((v) => v.label !== "Alertas").map((v) => (
                          <div key={v.label} className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{v.label}</span>
                            <button type="button" className="btn-ghost !py-1" onClick={() => decide(v.label, v.value, "revisar")}>Revisar</button>
                            <button type="button" className="btn-ghost !py-1" onClick={() => decide(v.label, v.value, "manter")}>Manter</button>
                          </div>
                        ))}
                        {decisions.length > 0 && (
                          <ul className="mt-2 text-xs text-[var(--text-muted)]">
                            {decisions.slice(0, 6).map((d) => (
                              <li key={d.id}>{d.createdAt.slice(0, 10)} · {d.item}: {d.decision}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => showHistory(r.toolId)}>
                      Ver histórico
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {history && (
        <div className="panel">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Histórico · {history.toolId}</p>
          {history.items.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum registro ainda. Atualizar cálculos grava um ponto no tempo.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {history.items.map((h, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-[var(--border)] py-1">
                  <span>{h.headline}</span>
                  <span className="text-[var(--text-muted)]">{h.createdAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
          {assessments.filter((a) => a.toolId === history.toolId).length > 1 && history.toolId === "cfs" && (
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Evolução CFS: {assessments.filter((a) => a.toolId === "cfs").slice().reverse().map((a) => `${a.createdAt.slice(0, 4)} → ${a.payload.cfs_score}`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ClinicalForms({
  onRecord,
  busy,
  doctorName,
}: {
  onRecord: (toolId: string, payload: Record<string, string | number | boolean | null>, extra?: { context?: string; note?: string }) => Promise<void>;
  busy: boolean;
  doctorName: string;
}) {
  const [cfs, setCfs] = useState("");
  const [cfsCtx, setCfsCtx] = useState("");
  const [cfsNote, setCfsNote] = useState("");
  const [abvd, setAbvd] = useState("");
  const [aivd, setAivd] = useState("");
  const [mob, setMob] = useState("");
  const [dep, setDep] = useState("");
  const [care, setCare] = useState("");
  const [spictYes, setSpictYes] = useState(false);
  const [necpalSurp, setNecpalSurp] = useState(false);
  const [necpalInd, setNecpalInd] = useState(false);
  const [pps, setPps] = useState("");

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <form
        className="panel space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(cfs);
          if (!Number.isInteger(n) || n < 1 || n > 9) return;
          onRecord("cfs", { cfs_score: n }, { context: cfsCtx, note: cfsNote });
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Fragilidade</p>
        <p className="font-display text-lg font-extrabold">Clinical Frailty Scale</p>
        <p className="text-sm text-[var(--text-muted)]">Não calculamos pela idade. Avalie no instrumento oficial e registre o escore.</p>
        <a className="text-sm font-semibold text-[var(--gold)]" href="https://www.dal.ca/sites/gmr/our-tools/clinical-frailty-scale.html" target="_blank" rel="noreferrer">Abrir CFS oficial →</a>
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" inputMode="numeric" placeholder="Escore 1–9" value={cfs} onChange={(e) => setCfs(e.target.value)} />
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Contexto (ex.: consulta)" value={cfsCtx} onChange={(e) => setCfsCtx(e.target.value)} />
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Observação" value={cfsNote} onChange={(e) => setCfsNote(e.target.value)} />
        <p className="text-xs text-[var(--text-muted)]">Avaliado por: {doctorName || "médico logado"}</p>
        <button type="submit" className="btn-gold" disabled={busy}>Registrar CFS</button>
      </form>

      <form
        className="panel space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onRecord("function_basic", { abvd, aivd, mobilidade: mob, dependencia: dep, cuidador: care });
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Funcionalidade</p>
        <p className="font-display text-lg font-extrabold">Registro básico</p>
        <p className="text-sm text-[var(--text-muted)]">Não é escala licenciada nem nota de mortalidade.</p>
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="ABVD" value={abvd} onChange={(e) => setAbvd(e.target.value)} />
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="AIVD" value={aivd} onChange={(e) => setAivd(e.target.value)} />
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Mobilidade" value={mob} onChange={(e) => setMob(e.target.value)} />
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Dependência" value={dep} onChange={(e) => setDep(e.target.value)} />
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Cuidador" value={care} onChange={(e) => setCare(e.target.value)} />
        <button type="submit" className="btn-gold" disabled={busy}>Salvar funcionalidade</button>
      </form>

      <form
        className="panel space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onRecord("spict", { spict_avaliado: true, spict_indicadores: spictYes });
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Necessidades paliativas / suporte</p>
        <p className="font-display text-lg font-extrabold">SPICT</p>
        <p className="text-sm text-[var(--text-muted)]">Não é expectativa de vida. Nunca rotula “paciente é paliativo”.</p>
        <a className="text-sm font-semibold text-[var(--gold)]" href="https://www.spict.org.uk/" target="_blank" rel="noreferrer">Abrir SPICT oficial →</a>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spictYes} onChange={(e) => setSpictYes(e.target.checked)} />
          Indicadores do instrumento oficial presentes — considerar avaliação de cuidados de suporte
        </label>
        <button type="submit" className="btn-gold" disabled={busy}>Registrar SPICT</button>
      </form>

      <form
        className="panel space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onRecord("necpal", { necpal_avaliado: true, necpal_surpresa_nao: necpalSurp, necpal_indicadores: necpalInd });
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Necessidades paliativas / suporte</p>
        <p className="font-display text-lg font-extrabold">NECPAL</p>
        <p className="text-sm text-[var(--text-muted)]">Não estima sobrevida e não recusa diálise.</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={necpalSurp} onChange={(e) => setNecpalSurp(e.target.checked)} />
          Não se surpreenderia com óbito em cerca de 12 meses
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={necpalInd} onChange={(e) => setNecpalInd(e.target.checked)} />
          Indicadores de doença crônica avançada (instrumento oficial)
        </label>
        <button type="submit" className="btn-gold" disabled={busy}>Registrar NECPAL</button>
      </form>

      <form
        className="panel space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(pps);
          if (!Number.isFinite(n)) return;
          onRecord("pps", { pps_score: n });
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Prognóstico (registro)</p>
        <p className="font-display text-lg font-extrabold">PPS</p>
        <p className="text-sm text-[var(--text-muted)]">Conteúdo oficial do PPSv2 não está incorporado (licença). Só registramos o escore que você atribuiu.</p>
        <input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" inputMode="numeric" placeholder="Escore 0–100" value={pps} onChange={(e) => setPps(e.target.value)} />
        <button type="submit" className="btn-gold" disabled={busy}>Registrar PPS</button>
      </form>
    </div>
  );
}
