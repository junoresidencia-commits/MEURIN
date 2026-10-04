"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { REFERRAL_STATUS_LABELS, type ReferralStatus } from "@/lib/network-types";

type Referral = {
  id: string;
  patientKey: string;
  patientName: string | null;
  fromName: string;
  fromProfession: string | null;
  fromSpecialty: string | null;
  toName: string;
  toProfession: string | null;
  toSpecialty: string | null;
  reason: string | null;
  notes: string | null;
  status: ReferralStatus;
  consentConfirmed: boolean;
  consentMethod: string | null;
  createdAt: string;
};

function chartHref(key: string) {
  return `/medicos/paciente/${encodeURIComponent(key)}`;
}

export function ReferralInbox({ title = "Pacientes encaminhados para mim" }: { title?: string }) {
  const [incoming, setIncoming] = useState<Referral[]>([]);
  const [outgoing, setOutgoing] = useState<Referral[]>([]);
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [msg, setMsg] = useState("");

  function load() {
    fetch("/api/network/referrals")
      .then((r) => r.json())
      .then((d) => {
        setIncoming(d.incoming || []);
        setOutgoing(d.outgoing || []);
      })
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: ReferralStatus) {
    setMsg("");
    const res = await fetch(`/api/network/referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(d.error || "Não foi possível atualizar.");
      return;
    }
    load();
  }

  const list = tab === "incoming" ? incoming : outgoing;

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold text-[var(--text)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        O cadastro do paciente não é duplicado. O encaminhamento cria um vínculo de acompanhamento com o profissional que aceitar.
      </p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => setTab("incoming")} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === "incoming" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white"}`}>
          Recebidos
        </button>
        <button type="button" onClick={() => setTab("outgoing")} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === "outgoing" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white"}`}>
          Enviados
        </button>
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
      <div className="mt-5 grid gap-3">
        {list.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum encaminhamento nesta lista.</p>}
        {list.map((s) => (
          <div key={s.id} className="panel">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              {REFERRAL_STATUS_LABELS[s.status] || s.status}
              {" · "}{new Date(s.createdAt).toLocaleString("pt-BR")}
            </p>
            <p className="font-display text-lg font-bold text-[var(--text)]">{s.patientName || s.patientKey}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Encaminhado por: {s.fromName} {s.fromSpecialty ? `— ${s.fromSpecialty}` : s.fromProfession ? `— ${s.fromProfession}` : ""}
            </p>
            <p className="text-sm text-[var(--text-soft)]">
              Para: {s.toName} {s.toSpecialty ? `— ${s.toSpecialty}` : s.toProfession ? `— ${s.toProfession}` : ""}
            </p>
            {s.reason && <p className="mt-2 text-sm text-[var(--text-soft)]"><b>Motivo:</b> {s.reason}</p>}
            {s.notes && <p className="text-sm text-[var(--text-soft)]"><b>Observação:</b> {s.notes}</p>}
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Consentimento: {s.consentConfirmed ? "registrado" : "pendente"}{s.consentMethod ? ` · ${s.consentMethod}` : ""}
            </p>
            {tab === "incoming" && s.consentConfirmed && ["pending", "viewed"].includes(s.status) && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-gold text-sm" onClick={() => setStatus(s.id, "accepted")}>Aceitar</button>
                <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(s.id, "declined")}>Recusar</button>
              </div>
            )}
            {tab === "incoming" && ["accepted", "following"].includes(s.status) && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={chartHref(s.patientKey)} className="btn-gold inline-flex text-sm">Abrir prontuário</Link>
                {s.status === "accepted" && (
                  <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(s.id, "following")}>Em acompanhamento</button>
                )}
                <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(s.id, "finished")}>Finalizar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
