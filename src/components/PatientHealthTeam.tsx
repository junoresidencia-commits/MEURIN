"use client";

import { useEffect, useState } from "react";
import { CareMessageThread } from "@/components/CareMessageThread";
import { professionalWhatsAppLink } from "@/lib/contact";

type Member = {
  role: string;
  professionalId: string;
  name: string;
  registry?: string;
  email?: string | null;
  phone?: string | null;
  reason?: string | null;
  referredAt?: string | null;
  unread?: number;
};

type Team = {
  nephrologist: { name: string; crm?: string; specialty?: string } | null;
  team: Member[];
};

const ROLE: Record<string, string> = {
  nutrition: "Nutricionista",
  psychology: "Psicólogo(a)",
  nursing: "Enfermeiro(a)",
  cardiology: "Cardiologista",
  endocrinology: "Endocrinologista",
};

export function PatientHealthTeam() {
  const [data, setData] = useState<Team | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/patient/care-team").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);
  if (!data) return null;
  const hasTeam = data.nephrologist || (data.team && data.team.length > 0);
  if (!hasTeam) return null;

  return (
    <section id="equipe" className="panel mt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Minha Equipe de Saúde</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Seu nefrologista encaminhou estes profissionais. Você pode mandar uma mensagem por aqui, e-mail ou WhatsApp.</p>
      <div className="mt-3 space-y-3">
        {data.nephrologist && (
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">Nefrologista</p>
            <p className="font-semibold text-[var(--text)]">{data.nephrologist.name}</p>
          </div>
        )}
        {data.team.map((m) => {
          const wa = professionalWhatsAppLink(m.phone, `Olá, ${m.name.split(" ")[0]}. Sou paciente do Meu Rim e fui encaminhado(a) para você.`);
          const open = openId === m.professionalId;
          return (
            <div key={m.professionalId} className="rounded-2xl border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">{ROLE[m.role] || m.role}</p>
                  <p className="font-semibold text-[var(--text)]">{m.name}{m.registry ? <span className="ml-1 text-sm font-normal text-[var(--text-muted)]">{m.registry}</span> : null}</p>
                  {m.reason && <p className="text-xs text-[var(--text-muted)]">Motivo: {m.reason}</p>}
                </div>
                {m.unread ? <span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[11px] font-bold text-white">{m.unread} nova{m.unread > 1 ? "s" : ""}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn-gold text-sm" onClick={() => setOpenId(open ? null : m.professionalId)}>
                  {open ? "Fechar conversa" : "Enviar mensagem"}
                </button>
                {m.email && (
                  <a className="btn-ghost text-sm" href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Mensagem pelo Meu Rim")}`}>E-mail</a>
                )}
                {wa && (
                  <a className="btn-ghost text-sm" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
                )}
              </div>
              {open && (
                <CareMessageThread role={m.role} professionalId={m.professionalId} viewer="patient" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
