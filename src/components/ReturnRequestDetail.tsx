"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReturnStatusBadge } from "@/components/ReturnStatusBadge";
import { ReturnRequestChat } from "@/components/ReturnRequestChat";
import {
  ASK_INFO_MESSAGE,
  DEADLINE_REFUSAL_MESSAGE,
  RETURN_HABITUAL_DAYS,
  STATUS_HINT,
  formatCents,
  newConsultHref,
  type ReturnEvent,
  type ReturnRequest,
} from "@/lib/return-request-types";

type Who = "patient" | "professional" | "attendant";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function fmtHour(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtWhen(iso?: string | null) {
  if (!iso) return "—";
  return `${fmtDate(iso)} · ${fmtHour(iso)}`;
}

export function ReturnRequestDetail({
  id,
  backHref,
  loginHref,
}: {
  id: string;
  backHref: string;
  loginHref: string;
}) {
  const router = useRouter();
  const [row, setRow] = useState<ReturnRequest | null>(null);
  const [events, setEvents] = useState<ReturnEvent[]>([]);
  const [you, setYou] = useState<Who | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [refuseOpen, setRefuseOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/return-requests/${id}`);
    if (res.status === 401) {
      router.replace(loginHref);
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Solicitação não encontrada.");
      return;
    }
    setRow(data.request);
    setEvents(data.events || []);
    setYou(data.you);
  }, [id, loginHref, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(path: string, body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível concluir.");
      if (data.redirect) {
        router.push(data.redirect);
        return;
      }
      if (data.request?.bookingId && data.request.status === "awaiting_payment" && (data.request.priceCents || 0) > 0) {
        router.push(`/confirmacao/${data.request.bookingId}`);
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy("");
    }
  }

  async function patch(action: string) {
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`/api/return-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy("");
    }
  }

  if (error && !row) return <div className="mx-auto max-w-lg px-5 py-16 text-sm text-[var(--danger)]">{error}</div>;
  if (!row) return <div className="mx-auto max-w-lg px-5 py-16 text-[var(--text-muted)]">Carregando…</div>;

  const over30 = row.daysSinceLast != null && row.daysSinceLast > RETURN_HABITUAL_DAYS;
  const openDecision = ["pending_review", "awaiting_patient", "suggested_slot"].includes(row.status);
  const isPro = you === "professional" || you === "attendant";
  const consultHref = newConsultHref(row.professionalKind, row.professionalId);

  return (
    <div className="mx-auto max-w-lg px-5 pb-28 pt-8">
      <Link href={backHref} className="text-sm font-semibold text-[var(--gold)]">← Voltar</Link>
      <h1 className="font-display mt-3 text-2xl font-extrabold text-[var(--text)]">
        {you === "patient" ? row.professionalName : row.patientName}
      </h1>
      <p className="text-sm text-[var(--gold)]">{row.professionalSpecialty || "Retorno solicitado"}</p>
      <div className="mt-3">
        <ReturnStatusBadge status={row.status} />
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{STATUS_HINT[row.status]}</p>

      <div className="panel mt-4 space-y-2 text-sm">
        <p><span className="text-[var(--text-muted)]">Tipo solicitado</span><br /><b>Retorno</b> — o paciente solicitou; o profissional valida.</p>
        <p>📅 {fmtDate(row.requestedSlotStart)} · 🕐 {fmtHour(row.requestedSlotStart)}</p>
        {row.suggestedSlotStart && <p>Horário sugerido: {fmtWhen(row.suggestedSlotStart)}</p>}
        <div className="rounded-xl bg-[var(--bg)] p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Última consulta</p>
          {row.lastVisitSource === "registered" && row.lastVisitAt ? (
            <>
              <p className="mt-1">{fmtDate(row.lastVisitAt)}</p>
              <p>Tempo desde a última consulta: {row.daysSinceLast} dias</p>
              <p className={`mt-1 font-semibold ${row.withinHabitual ? "text-emerald-700" : "text-amber-700"}`}>
                {row.withinHabitual
                  ? "🟢 Dentro do período habitual de retorno"
                  : "⚠️ O período habitual de retorno de 30 dias já foi ultrapassado."}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Isso não confirma automaticamente o retorno. A validação é do profissional.</p>
            </>
          ) : (
            <>
              <p className="mt-1">Consulta anterior não localizada no Meu Rim{row.lastVisitAt ? ", conforme informado pelo paciente" : ". O paciente ainda pode solicitar o retorno"}.</p>
              {row.lastVisitAt && <p>Quando (informado): {fmtDate(row.lastVisitAt)}</p>}
              {row.lastVisitLocation && <p>Onde: {row.lastVisitLocation}</p>}
            </>
          )}
        </div>
        {row.priceCents != null && (
          <p>Valor: <b>{formatCents(row.priceCents)}</b>{row.paymentStatus ? ` · ${row.paymentStatus}` : ""}</p>
        )}
        {row.exceptionalAfter30 && (
          <p className="text-xs font-semibold text-amber-800">Retorno autorizado manualmente apesar do prazo de 30 dias ter sido ultrapassado.</p>
        )}
        {row.decisionBy && row.decisionAt && (
          <p className="text-xs text-[var(--text-muted)]">Validação: {row.decision} · {fmtWhen(row.decisionAt)}</p>
        )}
        {row.refusalReason && <p className="text-sm text-red-700">{row.refusalReason}</p>}
        {row.autoMessage && <p className="whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-sm text-red-800">{row.autoMessage}</p>}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

      {you === "patient" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {["pending_review", "awaiting_patient", "suggested_slot"].includes(row.status) && (
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => patch("cancel")}>
              Cancelar solicitação
            </button>
          )}
          {row.status === "suggested_slot" && (
            <>
              <button type="button" className="btn-gold" disabled={!!busy} onClick={() => act(`/api/return-requests/${id}/patient`, { action: "accept_slot" }, "accept")}>
                Aceitar horário
              </button>
              <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => act(`/api/return-requests/${id}/patient`, { action: "choose_other" }, "other")}>
                Escolher outro horário
              </button>
            </>
          )}
          {row.status === "awaiting_payment" && (
            <>
              <button type="button" className="btn-gold" disabled={!!busy} onClick={() => act(`/api/return-requests/${id}/patient`, { action: "confirm_new" }, "confirm")}>
                Confirmar nova consulta
              </button>
              <Link className="btn-ghost" href={consultHref}>Escolher outro horário</Link>
            </>
          )}
          {row.status === "refused_deadline" && (
            <Link className="btn-gold" href={consultHref}>Agendar nova consulta</Link>
          )}
          {(row.status === "confirmed_return" || row.status === "confirmed_new") && row.bookingId && (
            <Link className="btn-gold" href={`/confirmacao/${row.bookingId}`}>Ver atendimento</Link>
          )}
        </div>
      )}

      {isPro && openDecision && (
        <div className="panel mt-4 space-y-3">
          <p className="font-semibold text-[var(--text)]">O paciente informou que este atendimento é um retorno. Confirme se ele ainda se encontra no período de retorno e se este atendimento deve ser realizado como retorno.</p>
          {over30 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              ⚠️ O período habitual de retorno de 30 dias já foi ultrapassado.
              {row.daysSinceLast != null ? ` Tempo desde a consulta: ${row.daysSinceLast} dias.` : ""} Sugestão do sistema: converter em nova consulta. Você ainda pode autorizar o retorno.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {over30 ? (
              <button type="button" className="btn-gold" disabled={!!busy} onClick={() => act(`/api/return-requests/${id}/decide`, { decision: "confirm_return_exception", message }, "confirm")}>
                Confirmar como retorno mesmo assim
              </button>
            ) : (
              <button type="button" className="btn-gold" disabled={!!busy} onClick={() => act(`/api/return-requests/${id}/decide`, { decision: "confirm_return", message }, "confirm")}>
                Confirmar como retorno
              </button>
            )}
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => act(`/api/return-requests/${id}/decide`, { decision: "convert_new", message }, "convert")}>
              Converter em nova consulta
            </button>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Solicitar outra data</span>
            <input type="datetime-local" className="input-field" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy || !slotStart}
            onClick={() => {
              const start = new Date(slotStart);
              act(`/api/return-requests/${id}/decide`, {
                decision: "suggest_slot",
                slotStart: start.toISOString(),
                slotEnd: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
                message: message || `Sugiro outro horário: ${start.toLocaleString("pt-BR")}.`,
              }, "slot");
            }}
          >
            Solicitar outra data
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() => act(`/api/return-requests/${id}/decide`, { decision: "ask_info", message: message || ASK_INFO_MESSAGE }, "info")}
          >
            Pedir informações
          </button>
          {you === "professional" && (
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy}
              onClick={() => act(`/api/return-requests/${id}/decide`, { decision: "invite_attendant", message: message || "Encaminhei esta solicitação para a atendente concluir o agendamento." }, "att")}
            >
              Encaminhar para atendente
            </button>
          )}
          <button type="button" className="btn-ghost text-[var(--danger)]" onClick={() => setRefuseOpen((v) => !v)}>
            Recusar solicitação
          </button>
          {refuseOpen && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
              {over30 && (
                <>
                  <p className="text-sm font-semibold text-red-800">Motivo sugerido: Prazo de retorno ultrapassado</p>
                  <textarea
                    className="input-field min-h-[100px]"
                    value={message || DEADLINE_REFUSAL_MESSAGE}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-gold w-full"
                    disabled={!!busy}
                    onClick={() => act(`/api/return-requests/${id}/decide`, {
                      decision: "refuse_deadline",
                      message: message || DEADLINE_REFUSAL_MESSAGE,
                      refusalReason: "Prazo de retorno ultrapassado",
                    }, "refuse")}
                  >
                    Recusar — prazo de retorno ultrapassado
                  </button>
                </>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Outro motivo</span>
                <textarea className="input-field min-h-[72px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explique o motivo da recusa." />
              </label>
              <button
                type="button"
                className="btn-ghost w-full text-[var(--danger)]"
                disabled={!!busy}
                onClick={() => act(`/api/return-requests/${id}/decide`, { decision: "refuse", message, refusalReason: message || "Solicitação não aprovada." }, "refuse")}
              >
                Recusar
              </button>
            </div>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Mensagem (opcional / editável)</span>
            <textarea className="input-field min-h-[72px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem para o paciente…" />
          </label>
        </div>
      )}

      {isPro && (row.status === "confirmed_return" || row.status === "confirmed_new" || row.status === "awaiting_payment") && (
        <button type="button" className="btn-ghost mt-4" disabled={!!busy} onClick={() => patch("close")}>
          Concluir atendimento
        </button>
      )}

      <ReturnRequestChat requestId={id} chatOpen={row.chatOpen} />

      <div className="panel mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Histórico desta solicitação</p>
        <ul className="mt-2 space-y-2 text-sm">
          {events.length === 0 && <li className="text-[var(--text-muted)]">Sem eventos ainda.</li>}
          {events.map((e) => (
            <li key={e.id}>
              <span className="text-xs text-[var(--text-muted)]">{fmtWhen(e.at)} · {e.actor}</span>
              <p className="text-[var(--text)]">{e.detail || e.type}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
