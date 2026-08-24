"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Med = {
  id: string; name: string; dose: string | null; quantity: string | null; frequency: string | null;
  times: string[]; guidance: string | null; notes: string | null; source: "patient" | "doctor";
  confirmedByDoctor: boolean; confirmedBy?: string | null; status: "active" | "suspended";
  suspendedBy?: string | null; suspendReason?: string | null;
};
type Dose = { medicationId: string; medName: string; dose: string | null; time: string; status: "taken" | "missed" | "none"; reason: string | null; reasonText: string | null };
type DayView = { date: string; doses: Dose[]; status: "todas" | "parcial" | "varias" | "sem_info"; counts: { taken: number; missed: number; none: number } };
type Summary = { scheduled: number; taken: number; missed: number; none: number; adherencePct: number | null; topReason: { value: string; label: string; count: number } | null; outOfMedEpisodes: number; rangeDays: number };
type Resp = { medications: Med[]; summary: Summary; history: DayView[]; calendar: { date: string; status: DayView["status"] }[]; range: { from: string; to: string } };

const REASONS = [
  { value: "esqueci", label: "Esqueci" }, { value: "acabou", label: "Medicamento acabou" }, { value: "nao_comprou", label: "Não consegui comprar" },
  { value: "efeito_colateral", label: "Tive efeito colateral" }, { value: "nao_entendi", label: "Não entendi como tomar" },
  { value: "fora_de_casa", label: "Estava fora de casa" }, { value: "medico_suspendeu", label: "Outro médico orientou suspender" }, { value: "outro", label: "Outro" },
];
const reasonLabel = (v?: string | null) => (v ? REASONS.find((r) => r.value === v)?.label || v : "");
const fmtDate = (d: string) => d.split("-").reverse().join("/");
const DAY_DOT: Record<DayView["status"], string> = { todas: "bg-emerald-500", parcial: "bg-amber-500", varias: "bg-red-500", sem_info: "bg-slate-300" };

export function DoctorMedicationsView({ emailParam }: { emailParam: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [medFilter, setMedFilter] = useState("");
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", dose: "", quantity: "", frequency: "", guidance: "" });
  const [times, setTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");
  const [openDay, setOpenDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ days });
    if (medFilter) qs.set("medicationId", medFilter);
    const res = await fetch(`/api/doctor/patients/${emailParam}/medications?${qs.toString()}`);
    if (!res.ok) { setMsg("Não foi possível carregar."); return; }
    setData(await res.json());
  }, [emailParam, days, medFilter]);
  useEffect(() => { load(); }, [load]);

  async function action(body: Record<string, unknown>) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/medications`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Erro"); }
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }
  async function confirmMed(id: string) { await action({ id, action: "confirm" }); }
  async function suspendMed(id: string) {
    const reason = window.prompt("Motivo da suspensão (opcional):") ?? undefined;
    await action({ id, action: "suspend", reason });
  }
  function addTime() {
    const m = timeInput.match(/^(\d{1,2}):(\d{2})$/); if (!m) return;
    setTimes((p) => Array.from(new Set([...p, `${String(Math.min(23, Number(m[1]))).padStart(2, "0")}:${m[2]}`])).sort()); setTimeInput("");
  }
  async function addMed(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setMsg("Informe o nome."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/medications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, times }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Erro"); }
      setForm({ name: "", dose: "", quantity: "", frequency: "", guidance: "" }); setTimes([]); setShowAdd(false);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  const historyByDate = useMemo(() => new Map((data?.history || []).map((d) => [d.date, d])), [data]);
  const calByDate = useMemo(() => new Map((data?.calendar || []).map((c) => [c.date, c.status])), [data]);
  // Medicamentos com problema recorrente (>=3 doses não tomadas no período).
  const recurring = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const d of data?.history || []) for (const dose of d.doses) if (dose.status === "missed") {
      const cur = counts.get(dose.medicationId) || { name: dose.medName, n: 0 }; cur.n++; counts.set(dose.medicationId, cur);
    }
    return Array.from(counts.values()).filter((x) => x.n >= 3);
  }, [data]);

  if (!data) return <p className="text-sm text-[var(--text-muted)]">Carregando medicamentos…</p>;

  const active = data.medications.filter((m) => m.status === "active");
  const suspended = data.medications.filter((m) => m.status === "suspended");
  const s = data.summary;

  // Calendário do mês de `range.to`.
  const monthAnchor = data.range.to;
  const [yy, mm] = monthAnchor.split("-").map(Number);
  const firstWeekday = new Date(yy, mm - 1, 1).getDay();
  const daysInMonth = new Date(yy, mm, 0).getDate();

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft,#f8fafc)] px-3 py-2 text-sm text-[var(--text-soft)]">{msg}</p>}

      {/* Resumo */}
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg text-[var(--text)]">Adesão — últimos {days} dias</h3>
          <div className="flex gap-1">
            {(["7", "30", "90"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1 text-xs font-bold ${days === d ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>{d}d</button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Adesão registrada</p>
            <p className="text-xl font-extrabold text-[var(--text)]">{s.adherencePct != null ? `${s.adherencePct}%` : "—"}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Não tomadas</p>
            <p className="text-xl font-extrabold text-[var(--danger)]">{s.missed}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sem informação</p>
            <p className="text-xl font-extrabold text-slate-500">{s.none}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Tomadas</p>
            <p className="text-xl font-extrabold text-emerald-600">{s.taken}</p>
          </div>
        </div>
        <div className="mt-2 space-y-0.5 text-sm text-[var(--text-soft)]">
          {s.topReason && <p>Principal motivo: <b>{s.topReason.label}</b> ({s.topReason.count}x)</p>}
          {s.outOfMedEpisodes > 0 && <p>{s.outOfMedEpisodes} episódio(s) por falta do medicamento</p>}
        </div>
        {recurring.length > 0 && (
          <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠️ Dificuldade recorrente: {recurring.map((r) => `${r.name} (${r.n})`).join(", ")}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Dados informados pelo paciente. A interpretação e a conduta são do médico.</p>
      </section>

      {/* Medicamentos em uso */}
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg text-[var(--text)]">Medicamentos em uso</h3>
          <button type="button" className="btn-ghost !min-h-[38px] px-3 text-sm" onClick={() => setShowAdd((v) => !v)}>+ Medicamento</button>
        </div>
        {showAdd && (
          <form onSubmit={addMed} className="mt-3 space-y-2 rounded-xl border border-[var(--border)] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input-field !min-h-[42px]" placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className="input-field !min-h-[42px]" placeholder="Dose (ex.: 50 mg)" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />
              <input className="input-field !min-h-[42px]" placeholder="Quantidade (ex.: 1 comp.)" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <input className="input-field !min-h-[42px]" placeholder="Frequência" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="time" className="input-field !min-h-[42px] w-36" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} />
              <button type="button" className="btn-ghost !min-h-[38px] text-sm" onClick={addTime}>+ horário</button>
              {times.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-bold text-[var(--gold)]">{t}<button type="button" onClick={() => setTimes(times.filter((x) => x !== t))}>✕</button></span>)}
            </div>
            <input className="input-field !min-h-[42px]" placeholder="Orientação (opcional)" value={form.guidance} onChange={(e) => setForm({ ...form, guidance: e.target.value })} />
            <div className="flex gap-2"><button type="submit" className="btn-gold !min-h-[40px]" disabled={busy}>Salvar</button><button type="button" className="btn-ghost !min-h-[40px]" onClick={() => setShowAdd(false)}>Cancelar</button></div>
          </form>
        )}
        <div className="mt-3 grid gap-2">
          {active.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum medicamento ativo.</p>}
          {active.map((m) => (
            <div key={m.id} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text)]">{m.name}{m.dose ? ` ${m.dose}` : ""}</p>
                  <p className="text-xs text-[var(--text-muted)]">{[m.quantity, m.times.join(" e "), m.frequency].filter(Boolean).join(" · ") || "—"}</p>
                  <div className="mt-1">
                    {m.source === "doctor" ? <span className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--gold)]">Registrado pelo médico</span>
                      : m.confirmedByDoctor ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Confirmado pelo médico</span>
                      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Informado pelo paciente</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.source === "patient" && !m.confirmedByDoctor && <button type="button" className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50" disabled={busy} onClick={() => confirmMed(m.id)}>Confirmar</button>}
                  <button type="button" className="rounded-full border border-[var(--danger)]/40 px-3 py-1 text-xs font-bold text-[var(--danger)] hover:bg-[var(--danger)]/5" disabled={busy} onClick={() => suspendMed(m.id)}>Suspender</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {suspended.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Suspensos (histórico preservado)</p>
            <div className="mt-1 grid gap-1">
              {suspended.map((m) => (
                <p key={m.id} className="text-sm text-[var(--text-muted)]"><span className="line-through">{m.name}{m.dose ? ` ${m.dose}` : ""}</span>{m.suspendReason ? ` — ${m.suspendReason}` : ""}{m.suspendedBy ? ` (por ${m.suspendedBy})` : ""}</p>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Filtro por medicamento + alternância de visão */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select className="input-field !min-h-[40px] w-auto text-sm" value={medFilter} onChange={(e) => setMedFilter(e.target.value)}>
          <option value="">Todos os medicamentos</option>
          {data.medications.map((m) => <option key={m.id} value={m.id}>{m.name}{m.dose ? ` ${m.dose}` : ""}</option>)}
        </select>
        <div className="flex gap-1">
          <button type="button" onClick={() => setView("lista")} className={`rounded-full px-3 py-1 text-xs font-bold ${view === "lista" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>Lista</button>
          <button type="button" onClick={() => setView("calendario")} className={`rounded-full px-3 py-1 text-xs font-bold ${view === "calendario" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>Ver calendário</button>
        </div>
      </div>

      {/* Histórico cronológico */}
      {view === "lista" && (
        <section className="space-y-3">
          {data.history.length === 0 && <p className="panel text-sm text-[var(--text-muted)]">Sem doses programadas no período.</p>}
          {data.history.map((day) => (
            <div key={day.date} className={`panel ${day.status === "varias" ? "border-red-300" : day.status === "parcial" ? "border-amber-300" : ""}`}>
              <p className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
                <span className={`h-2.5 w-2.5 rounded-full ${DAY_DOT[day.status]}`} />
                {fmtDate(day.date)}
              </p>
              <div className="mt-2 grid gap-1">
                {day.doses.map((dose, i) => (
                  <div key={i} className={`flex items-baseline justify-between gap-2 rounded-lg px-2 py-1 text-sm ${dose.status === "missed" ? "bg-[var(--danger)]/5" : ""}`}>
                    <span className={dose.status === "taken" ? "text-[var(--text-muted)]" : "text-[var(--text)]"}>
                      {dose.status === "taken" ? "✅" : dose.status === "missed" ? "❌" : "⏳"} {dose.medName}{dose.dose ? ` ${dose.dose}` : ""} — {dose.time}
                    </span>
                    <span className={`shrink-0 text-xs ${dose.status === "missed" ? "font-semibold text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                      {dose.status === "taken" ? "Tomou" : dose.status === "missed" ? `Não tomou${dose.reason ? ` · ${reasonLabel(dose.reason)}` : ""}${dose.reasonText ? ` (${dose.reasonText})` : ""}` : "Não informou ainda"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Calendário */}
      {view === "calendario" && (
        <section className="panel">
          <p className="font-display text-lg text-[var(--text)]">{fmtDate(monthAnchor).slice(3)}</p>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-[var(--text-muted)]">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => <div key={i}>{w}</div>)}
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dnum = i + 1;
              const dstr = `${yy}-${String(mm).padStart(2, "0")}-${String(dnum).padStart(2, "0")}`;
              const st = calByDate.get(dstr);
              const dot = st ? DAY_DOT[st] : "";
              return (
                <button key={dstr} type="button" onClick={() => setOpenDay(historyByDate.has(dstr) ? dstr : null)} className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm ${openDay === dstr ? "border-[var(--gold)]" : "border-[var(--border)]"}`}>
                  <span className="text-[var(--text-soft)]">{dnum}</span>
                  {st ? <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${dot}`} /> : <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-transparent" />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> tudo tomado</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> alguma falha</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> várias falhas</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> sem info</span>
          </div>
          {openDay && historyByDate.get(openDay) && (
            <div className="mt-3 rounded-xl border border-[var(--border)] p-3">
              <p className="text-sm font-bold text-[var(--text)]">{fmtDate(openDay)}</p>
              <div className="mt-1 grid gap-1">
                {historyByDate.get(openDay)!.doses.map((dose, i) => (
                  <p key={i} className="text-sm text-[var(--text-soft)]">
                    {dose.status === "taken" ? "✅" : dose.status === "missed" ? "❌" : "⏳"} {dose.medName}{dose.dose ? ` ${dose.dose}` : ""} — {dose.time}{dose.status === "missed" && dose.reason ? ` · ${reasonLabel(dose.reason)}` : ""}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
