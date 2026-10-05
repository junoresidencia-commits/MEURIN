"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type Slot = { start: string; end: string; label: string };
type Pro = { kind: string; id: string; displayName: string; specialty: string; consultationPriceCents: number; returnPriceCents: number };
type Last = { at: string; days: number; within: boolean; label: string } | null;

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AgendarTipoPage() {
  const params = useParams<{ kind: string; id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const forced = search.get("tipo");
  const [step, setStep] = useState<"tipo" | "ja" | "sem-registro" | "horario" | "confirma" | "enviado">(forced === "retorno" ? "ja" : forced === "consulta" ? "tipo" : "tipo");
  const [pro, setPro] = useState<Pro | null>(null);
  const [last, setLast] = useState<Last>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [seen, setSeen] = useState<null | boolean>(null);
  const [notOnPlatform, setNotOnPlatform] = useState(false);
  const [approx, setApprox] = useState<"date" | "month_year" | "unknown">("unknown");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    fetch(`/api/professionals/${params.kind}/${params.id}?visit=retorno`)
      .then((r) => r.json())
      .then((d) => {
        setPro(d.professional);
        setLast(d.lastVisit || null);
        setSlots(d.slots || []);
      });
  }, [params.kind, params.id]);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = fmtDay(s.start);
      map.set(key, [...(map.get(key) || []), s]);
    }
    return [...map.entries()];
  }, [slots]);

  async function send() {
    if (!slot) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/return-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalKind: params.kind,
          professionalId: params.id,
          slotStart: slot.start,
          slotEnd: slot.end,
          alreadySeen: true,
          lastVisitApprox: last ? "date" : approx,
          lastVisitWhen: last ? last.at : when,
          lastVisitLocation: where,
          note,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push(`/paciente/entrar?next=/paciente/agendar/${params.kind}/${params.id}?tipo=retorno`);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar.");
      setCreatedId(data.request.id);
      setStep("enviado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  if (!pro) return <div className="mx-auto max-w-lg px-5 py-16 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-8">
      <Link href={`/profissional/${params.kind}/${params.id}`} className="text-sm font-semibold text-[var(--gold)]">← {pro.displayName}</Link>
      <h1 className="font-display mt-3 text-2xl font-extrabold text-[var(--text)]">{pro.displayName}</h1>
      <p className="text-sm text-[var(--gold)]">{pro.specialty}</p>

      {step === "tipo" && (
        <div className="panel mt-5 space-y-3">
          <p className="font-semibold text-[var(--text)]">Qual tipo de atendimento você deseja?</p>
          <button type="button" className="btn-gold w-full" onClick={() => router.push(params.kind === "doctor" ? `/agendar?medico=${params.id}` : `/profissional/${params.kind}/${params.id}`)}>
            Primeira consulta / Nova consulta
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep("ja")}>Retorno</button>
          <p className="text-sm text-[var(--text-muted)]">Para pacientes que já foram atendidos anteriormente por este profissional. A solicitação de retorno será avaliada antes da confirmação.</p>
        </div>
      )}

      {step === "ja" && (
        <div className="panel mt-5 space-y-3">
          <p className="font-semibold text-[var(--text)]">Você já foi atendido anteriormente por este profissional?</p>
          <button type="button" className="btn-gold w-full" onClick={() => { setSeen(true); setStep(last ? "horario" : "sem-registro"); }}>Sim, já fui atendido</button>
          <button type="button" className="btn-ghost w-full" onClick={() => { setSeen(false); setStep("tipo"); }}>Não, será minha primeira consulta</button>
          {seen === false && <p className="text-sm text-[var(--text-muted)]">Neste caso, use Primeira consulta / Nova consulta.</p>}
        </div>
      )}

      {step === "sem-registro" && (
        <div className="panel mt-5 space-y-3">
          <p className="font-semibold text-[var(--text)]">Já foi atendido anteriormente?</p>
          <p className="text-sm text-[var(--text-muted)]">Sim, porém minha consulta anterior não aparece no Meu Rim.</p>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Quando aproximadamente você foi atendido?</span>
            <select className="input-field" value={approx} onChange={(e) => setApprox(e.target.value as typeof approx)}>
              <option value="date">Data aproximada</option>
              <option value="month_year">Mês/ano</option>
              <option value="unknown">Não lembro</option>
            </select>
          </label>
          {approx === "date" && <input type="date" className="input-field" value={when} onChange={(e) => setWhen(e.target.value)} />}
          {approx === "month_year" && <input type="month" className="input-field" value={when} onChange={(e) => setWhen(e.target.value)} />}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Onde você foi atendido?</span>
            <input className="input-field" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Ex.: Clínica Salute" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Deseja deixar uma informação para o profissional?</span>
            <textarea className="input-field min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fiz consulta com o senhor no mês passado e os exames solicitados ficaram prontos." />
          </label>
          <button type="button" className="btn-gold w-full" onClick={() => { setNotOnPlatform(true); setStep("horario"); }}>Continuar</button>
        </div>
      )}

      {step === "horario" && (
        <div className="mt-5 space-y-4">
          {last && (
            <div className="panel">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Última consulta</p>
              <p className="mt-1 font-semibold text-[var(--text)]">Data: {new Date(last.at).toLocaleDateString("pt-BR")}</p>
              <p className="text-sm text-[var(--text-muted)]">Profissional: {pro.displayName}</p>
              <p className="text-sm text-[var(--text-muted)]">Tempo desde a última consulta: {last.days} dias</p>
              <p className={`mt-2 text-sm font-semibold ${last.within ? "text-emerald-700" : "text-amber-700"}`}>
                {last.within ? "🟢 Dentro do período habitual de retorno." : "⚠️ O período habitual de retorno de 30 dias já foi ultrapassado."}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Isso não confirma automaticamente que o novo atendimento será um retorno. O profissional realizará a validação.</p>
            </div>
          )}
          {notOnPlatform && !last && (
            <p className="text-sm text-[var(--text-muted)]">Consulta anterior informada por você, ainda não registrada no Meu Rim.</p>
          )}
          <div className="panel">
            <p className="font-semibold text-[var(--text)]">Horários disponíveis para retorno</p>
            {slots.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">O profissional ainda não publicou horários específicos de retorno. Você pode indicar um horário preferido abaixo.</p>}
            {slots.length === 0 && (
              <label className="mt-3 block text-sm">
                Horário preferido
                <input type="datetime-local" className="input-field mt-1" onChange={(e) => {
                  const start = new Date(e.target.value);
                  if (Number.isNaN(start.getTime())) return;
                  setSlot({ start: start.toISOString(), end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(), label: start.toLocaleString("pt-BR") });
                }} />
              </label>
            )}
            {grouped.map(([day, list]) => (
              <div key={day} className="mt-3">
                <p className="text-sm font-semibold capitalize text-[var(--text)]">{day}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.map((s) => (
                    <button key={s.start} type="button" onClick={() => setSlot(s)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${slot?.start === s.start ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]" : "border-[var(--border)]"}`}>
                      {fmtHour(s.start)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className="btn-gold mt-4 w-full" disabled={!slot} onClick={() => setStep("confirma")}>Continuar</button>
          </div>
        </div>
      )}

      {step === "confirma" && slot && (
        <div className="panel mt-5 space-y-2">
          <p className="font-semibold text-[var(--text)]">Confirmar solicitação</p>
          <p><span className="text-[var(--text-muted)]">Profissional</span><br /><b>{pro.displayName}</b></p>
          <p><span className="text-[var(--text-muted)]">Tipo solicitado</span><br /><b>Retorno</b></p>
          <p><span className="text-[var(--text-muted)]">Data solicitada</span><br /><b>{new Date(slot.start).toLocaleDateString("pt-BR")}</b></p>
          <p><span className="text-[var(--text-muted)]">Horário solicitado</span><br /><b>{fmtHour(slot.start)}</b></p>
          <p className="text-sm text-[var(--text-muted)]">
            Última consulta: {last ? new Date(last.at).toLocaleDateString("pt-BR") : "Consulta anterior informada pelo paciente, ainda não registrada no Meu Rim."}
          </p>
          <p className="text-xs text-[var(--text-muted)]">O paciente solicita. O profissional valida. O horário não fica reservado agora.</p>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button type="button" className="btn-gold w-full" disabled={busy} onClick={send}>{busy ? "Enviando…" : "Enviar solicitação de retorno"}</button>
        </div>
      )}

      {step === "enviado" && (
        <div className="panel mt-5 space-y-3">
          <p className="text-lg font-extrabold text-[var(--text)]">Solicitação enviada ✅</p>
          <p className="text-sm text-[var(--text-muted)]">Seu retorno ainda precisa ser confirmado pelo profissional. O horário somente estará definitivamente reservado após essa confirmação.</p>
          <p className="font-semibold">{pro.displayName}</p>
          <p>Retorno solicitado</p>
          {slot && <p>📅 {new Date(slot.start).toLocaleDateString("pt-BR")} · 🕐 {fmtHour(slot.start)}</p>}
          <p>🟡 Aguardando confirmação do profissional</p>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-gold" href={`/paciente/retorno/${createdId}`}>Abrir conversa</Link>
            <Link className="btn-ghost" href={`/paciente/retorno/${createdId}`}>Ver solicitação</Link>
            <Link className="btn-ghost" href="/paciente/atendimentos">Meus atendimentos</Link>
          </div>
        </div>
      )}
    </div>
  );
}
