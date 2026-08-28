"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ReferToCareTeam } from "@/components/ReferToCareTeam";
import { ALLIED_ROLES, ROLE_META, type AlliedRole } from "@/lib/allied-types";

type Member = {
  id: string;
  name: string;
  registry?: string | null;
  uf?: string | null;
  referralId?: string;
};

type CareRole = "nutrition" | AlliedRole;

type Assigned = Record<CareRole, Member | null>;

type TeamPro = {
  id: string;
  role: string;
  name: string;
  registry?: string | null;
  uf?: string | null;
  active: boolean;
};

const ASSIGN_ROLES: CareRole[] = ["nutrition", ...ALLIED_ROLES];

const CARD_META: Record<CareRole, { title: string; registry: string; empty: string }> = {
  nutrition: { title: "Nutricionista", registry: "CRN", empty: "Nenhuma nutricionista encaminhada" },
  ...Object.fromEntries(ALLIED_ROLES.map((id) => [id, { title: ROLE_META[id].title, registry: ROLE_META[id].registry, empty: ROLE_META[id].emptyAssigned }])) as Record<AlliedRole, { title: string; registry: string; empty: string }>,
};

function emptyAssigned(): Assigned {
  return {
    nutrition: null,
    psychology: null,
    nursing: null,
    cardiology: null,
    endocrinology: null,
  };
}

function emptyTeam(): Record<CareRole, TeamPro[]> {
  return {
    nutrition: [],
    psychology: [],
    nursing: [],
    cardiology: [],
    endocrinology: [],
  };
}

export function CareTeamPatientCard({ emailParam, patientName }: { emailParam: string; patientName?: string }) {
  const [assigned, setAssigned] = useState<Assigned | null>(null);
  const [team, setTeam] = useState<Record<CareRole, TeamPro[]>>(emptyTeam);
  const [manage, setManage] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAssigned = useCallback(async () => {
    const d = await fetch(`/api/doctor/patients/${emailParam}/care-team`).then((r) => r.json());
    const next = emptyAssigned();
    next.nutrition = d.nutrition || null;
    for (const role of ALLIED_ROLES) next[role] = d[role] || null;
    setAssigned(next);
  }, [emailParam]);

  useEffect(() => { loadAssigned(); }, [loadAssigned]);
  useEffect(() => {
    fetch("/api/doctor/care-team").then((r) => r.json()).then((d) => {
      const next = emptyTeam();
      next.nutrition = (d.mine?.nutrition || []).filter((p: TeamPro) => p.active);
      for (const role of ALLIED_ROLES) next[role] = (d.mine?.[role] || []).filter((p: TeamPro) => p.active);
      setTeam(next);
    }).catch(() => {});
  }, []);

  async function remove(role: string, referralId?: string) {
    if (!referralId) return;
    if (!window.confirm("Retirar este profissional deste paciente? O histórico assistencial será preservado.")) return;
    await fetch(`/api/doctor/patients/${emailParam}/care-team`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, referralId }),
    });
    await loadAssigned();
  }

  async function assign(role: CareRole, professionalId: string) {
    setSaving(true); setMsg("");
    try {
      const current = assigned?.[role as keyof Assigned];
      if (current?.referralId) {
        await fetch(`/api/doctor/patients/${emailParam}/care-team`, {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, referralId: current.referralId }),
        });
      }
      if (professionalId) {
        const res = await fetch(`/api/doctor/patients/${emailParam}/care-refer`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, professionalId, reason: "Atribuição na equipe assistencial", patientName: patientName || null }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Não foi possível atribuir.");
      }
      await loadAssigned();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  function line(role: CareRole) {
    const m = assigned?.[role];
    const meta = CARD_META[role];
    return (
      <div key={role} className="flex items-start justify-between gap-2 border-b border-[var(--border)] py-2 last:border-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">{meta.title}</p>
          {m ? (
            <p className="font-semibold text-[var(--text)]">
              {m.name}
              {m.registry ? <span className="ml-1 text-sm font-normal text-[var(--text-muted)]">{meta.registry} {m.registry}{m.uf ? `-${m.uf}` : ""}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">{meta.empty}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="panel mt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Equipe assistencial</p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Encaminhe este paciente para nutricionista, psicóloga, enfermeira, cardiologista ou endocrinologista. O nome dele aparece na área de quem receber.</p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={() => setManage((v) => !v)}>{manage ? "Fechar" : "Gerenciar equipe"}</button>
      </div>

      <div className="mt-3">
        {ASSIGN_ROLES.map((role) => line(role))}
      </div>

      {manage && (
        <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-3">
          {ASSIGN_ROLES.map((role) => (
            <label key={role} className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{CARD_META[role].title}</span>
              <div className="flex flex-wrap gap-2">
                <select
                  className="input-field"
                  value={assigned?.[role]?.id || ""}
                  onChange={(e) => assign(role, e.target.value)}
                  disabled={saving}
                >
                  <option value="">Sem profissional neste paciente</option>
                  {(team[role] || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.registry ? ` · ${CARD_META[role].registry} ${p.registry}` : ""}</option>
                  ))}
                </select>
                {assigned?.[role]?.referralId && (
                  <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => remove(role, assigned[role]?.referralId)}>Retirar</button>
                )}
              </div>
            </label>
          ))}
          <p className="text-xs text-[var(--text-muted)]">Para cadastrar profissionais, use <Link href="/medicos/equipe-assistencial" className="font-semibold text-[var(--gold)]">Mais › Minha Equipe</Link>.</p>
        </div>
      )}

      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <ReferToCareTeam emailParam={emailParam} patientName={patientName} onDone={() => { void loadAssigned(); }} />
      </div>
      {msg && <p className="mt-2 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}

export function CareTimeline({ emailParam }: { emailParam: string }) {
  const [events, setEvents] = useState<{ at: string; area: string; label: string; by?: string | null; detail?: string | null; id: string }[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/doctor/patients/${emailParam}/care-timeline`).then((r) => r.json()).then((d) => setEvents(d.events || [])).catch(() => {});
  }, [emailParam]);

  if (events.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Ainda não há registros da equipe assistencial neste paciente.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <button
          key={ev.id + ev.at}
          type="button"
          className="panel w-full text-left transition hover:border-[var(--border-gold)]"
          onClick={() => setOpen(open === ev.id + ev.at ? null : ev.id + ev.at)}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            {new Date(ev.at).toLocaleDateString("pt-BR")} — {ev.area}
          </p>
          <p className="font-semibold text-[var(--text)]">{ev.label}</p>
          {ev.by && <p className="text-xs text-[var(--text-muted)]">{ev.by}</p>}
          {open === ev.id + ev.at && ev.detail && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-soft)]">{ev.detail}</p>
          )}
        </button>
      ))}
    </div>
  );
}
