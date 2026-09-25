"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Alert = { tone: "red" | "yellow" | "green"; text: string };
type Resumo = {
  today: { encounters: number; receivedCents: number; pendingCents: number };
  month: { producedCents: number; toPayoutCents: number };
  unpaidClosings: number;
  alerts: Alert[];
};

const TONE = {
  red: "border-red-200 bg-red-50 text-red-800",
  yellow: "border-amber-200 bg-amber-50 text-amber-900",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export default function ClinicaHomePage() {
  const params = useParams<{ id: string }>();
  const [clinic, setClinic] = useState("");
  const [status, setStatus] = useState("");
  const [canAdmin, setCanAdmin] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [finErr, setFinErr] = useState("");
  const [stockAlerts, setStockAlerts] = useState<Alert[]>([]);
  const [stockView, setStockView] = useState(false);

  useEffect(() => {
    fetch(`/api/clinica/${params.id}/me`)
      .then((r) => r.json())
      .then((d) => {
        setClinic(d.clinic?.name || "");
        setStatus(d.clinic?.status || "");
        setCanAdmin(Boolean(d.staff?.canAdmin));
        setStockView(Boolean(d.staff?.canAdmin || d.staff?.perms?.stock_view));
      })
      .catch(() => {});
    fetch(`/api/clinica/${params.id}/license`)
      .then((r) => r.json())
      .then((d) => setPlanName(d.plan?.name || null))
      .catch(() => setPlanName(null));
  }, [params.id]);

  useEffect(() => {
    if (!canAdmin) return;
    fetch(`/api/clinica/${params.id}/resumo`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar o financeiro agora.");
        setResumo(d.resumo);
        setFinErr("");
      })
      .catch((e) => setFinErr(e instanceof Error ? e.message : "Não foi possível carregar o financeiro agora."));
  }, [params.id, canAdmin]);

  useEffect(() => {
    if (!stockView) return;
    fetch(`/api/clinica/${params.id}/estoque?view=alerts`)
      .then((r) => r.json())
      .then((d) => setStockAlerts(d.alerts || []))
      .catch(() => setStockAlerts([]));
  }, [params.id, stockView]);

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--gold)]">Gestão da clínica</p>
      <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">{clinic || "Clínica"}</h1>
      {status === "pilot" && (
        <p className="mt-2 inline-block rounded-full bg-[var(--gold-soft)] px-3 py-1 text-xs font-bold uppercase text-[var(--gold)]">Piloto</p>
      )}
      {status === "suspended" && (
        <p className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          Clínica bloqueada. Gestora e check-in estão fechados. Pacientes e o caixa não foram apagados.
        </p>
      )}
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
        Esta área não substitui o prontuário nem o painel médico. Pacientes atuais continuam no médico;
        nada aqui move cadastro antigo.
      </p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {planName
          ? `Plano Meu Rim: ${planName}. O prontuário não depende desta licença.`
          : "Sem licença SaaS — agenda e prontuário continuam no médico."}
      </p>

      {canAdmin && resumo && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Consultas hoje</p><p className="font-display text-2xl font-extrabold">{resumo.today.encounters}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Entrou hoje</p><p className="font-display text-2xl font-extrabold">{brl(resumo.today.receivedCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Pendente hoje</p><p className="font-display text-2xl font-extrabold">{brl(resumo.today.pendingCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Produção do mês</p><p className="font-display text-2xl font-extrabold">{brl(resumo.month.producedCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">A repassar</p><p className="font-display text-2xl font-extrabold">{brl(resumo.month.toPayoutCents)}</p></div>
            <div className="panel"><p className="text-xs uppercase text-[var(--text-muted)]">Fechamentos em aberto</p><p className="font-display text-2xl font-extrabold">{resumo.unpaidClosings}</p></div>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Precisa de atenção</p>
            {resumo.alerts.map((a) => (
              <div key={a.text} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${TONE[a.tone]}`}>
                {a.tone === "red" ? "🔴" : a.tone === "yellow" ? "🟡" : "🟢"} {a.text}
              </div>
            ))}
          </div>
        </>
      )}
      {finErr && <p className="mt-4 text-sm text-[var(--danger)]">{finErr}</p>}
      {stockAlerts.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Estoque</p>
          {stockAlerts.map((a) => (
            <div key={a.text} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${TONE[a.tone]}`}>
              {a.tone === "red" ? "🔴" : "🟡"} {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {canAdmin && (
          <>
            <Link href={`/clinica/${params.id}/equipe`} className="panel block">
              <p className="font-bold">Equipe</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Convidar médico ou atendente. Se a pessoa já existe, só vincula.</p>
            </Link>
            <Link href={`/clinica/${params.id}/financeiro`} className="panel block">
              <p className="font-bold">Produção</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Atendido ≠ recebido. Regra no vínculo médico↔clínica.</p>
            </Link>
            <Link href={`/clinica/${params.id}/relatorios`} className="panel block">
              <p className="font-bold">Relatórios</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Planilha Excel para lista grande, PDF oficial para protocolar.</p>
            </Link>
            <Link href={`/clinica/${params.id}/fechamentos`} className="panel block">
              <p className="font-bold">Fechamentos</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Código MED-AAAA-######, PDF e comprovante de repasse.</p>
            </Link>
            <Link href={`/clinica/${params.id}/rede`} className="panel block">
              <p className="font-bold">Rede de cuidado</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Encaminhamento intra-clínica. O paciente continua no médico original.</p>
            </Link>
            <Link href={`/clinica/${params.id}/inteligencia`} className="panel block">
              <p className="font-bold">Inteligência clínica</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">O que sugerir. Nunca grava no perfil sozinha.</p>
            </Link>
          </>
        )}
        <Link href={`/clinica/${params.id}/caixa`} className="panel block">
          <p className="font-bold">Check-in</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Pago, pendente, cortesia, Pix, cartão ou dinheiro.</p>
        </Link>
        <Link href={`/clinica/${params.id}/caixa-despesas`} className="panel block">
          <p className="font-bold">Caixa e despesas</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Registrar saída, fluxo do dia e fechamento do caixa físico.</p>
        </Link>
        {stockView && (
          <Link href={`/clinica/${params.id}/estoque`} className="panel block">
            <p className="font-bold">Estoque</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Materiais, compras, validade e inventário desta clínica.</p>
          </Link>
        )}
      </div>
    </div>
  );
}
