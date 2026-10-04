"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";
import { honorific, type ReferralStatus } from "@/lib/network-types";

type Referral = {
  id: string;
  fromName: string;
  fromKind: "doctor" | "nutrition" | "psychology" | "nursing";
  toName: string;
  toKind: "doctor" | "nutrition" | "psychology" | "nursing";
  toSpecialty: string | null;
  status: ReferralStatus;
  consentConfirmed: boolean;
  consentRevokedAt: string | null;
};

export default function PacienteEncaminhamentosPage() {
  const router = useRouter();
  const [list, setList] = useState<Referral[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    fetch("/api/paciente/encaminhamentos").then(async (r) => {
      if (r.status === 401) { router.replace("/paciente/entrar"); return; }
      const d = await r.json();
      setList(d.referrals || []);
    });
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function answer(id: string, authorize: boolean) {
    setMsg("");
    const res = await fetch(`/api/network/referrals/${id}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorize }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(d.message || (authorize ? "Encaminhamento autorizado com sucesso." : "Encaminhamento não autorizado pelo paciente."));
    load();
  }

  const pending = list.filter((r) => r.status === "pending_consent" && !r.consentConfirmed);

  return (
    <div className="mx-auto max-w-lg px-5 pb-28 pt-8">
      <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Encaminhamentos</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Quando um profissional quiser encaminhá-lo, a autorização aparece aqui.
      </p>
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--green,#0d9488)]">{msg}</p>}
      <div className="mt-5 grid gap-3">
        {pending.length === 0 && list.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma solicitação no momento.</p>
        )}
        {pending.map((r) => (
          <div key={r.id} className="panel">
            <p className="text-sm text-[var(--text)]">
              {honorific(r.fromName, r.fromKind)} deseja encaminhá-lo para {honorific(r.toName, r.toKind)}
              {r.toSpecialty ? `, especialista em ${r.toSpecialty}` : ""}. Você autoriza o compartilhamento das informações necessárias para este encaminhamento?
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-gold text-sm" onClick={() => answer(r.id, true)}>Autorizar</button>
              <button type="button" className="btn-ghost text-sm" onClick={() => answer(r.id, false)}>Não autorizar</button>
            </div>
          </div>
        ))}
        {list.filter((r) => r.status !== "pending_consent").map((r) => (
          <div key={r.id} className="panel">
            <p className="text-sm text-[var(--text-soft)]">
              {honorific(r.fromName, r.fromKind)} → {honorific(r.toName, r.toKind)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {r.consentRevokedAt ? "Encaminhamento não autorizado pelo paciente." : r.consentConfirmed ? "Autorizado" : "Pendente"}
            </p>
          </div>
        ))}
      </div>
      <PatientNav />
    </div>
  );
}
