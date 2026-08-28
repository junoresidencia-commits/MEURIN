"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ALLIED_ROLES, ROLE_META, type AlliedRole } from "@/lib/allied-types";

type Role = "nutrition" | AlliedRole;
type Pro = { id: string; role: string; name: string; registry?: string | null; uf?: string | null; active?: boolean };

const ROLES: { id: Role; label: string; short: string; registry: string }[] = [
  { id: "nutrition", label: "Nutricionista", short: "Nutrição", registry: "CRN" },
  ...ALLIED_ROLES.map((id) => ({
    id,
    label: ROLE_META[id].referLabel.charAt(0).toUpperCase() + ROLE_META[id].referLabel.slice(1),
    short: ROLE_META[id].label,
    registry: ROLE_META[id].registry,
  })),
];

function emptyTeam(): Record<Role, Pro[]> {
  return {
    nutrition: [],
    psychology: [],
    nursing: [],
    cardiology: [],
    endocrinology: [],
  };
}

export function ReferToCareTeam({
  emailParam,
  patientName,
  compact = false,
  onDone,
}: {
  emailParam: string;
  patientName?: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const [team, setTeam] = useState<Record<Role, Pro[]>>(emptyTeam);
  const [role, setRole] = useState<Role | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/doctor/care-team").then((r) => r.json()).then((d) => {
      const next = emptyTeam();
      next.nutrition = (d.mine?.nutrition || []).filter((p: Pro) => p.active !== false);
      for (const id of ALLIED_ROLES) {
        next[id] = (d.mine?.[id] || []).filter((p: Pro) => p.active !== false);
      }
      setTeam(next);
    }).catch(() => {});
  }, []);

  const list = useMemo(() => (role ? team[role] : []), [role, team]);
  const meta = ROLES.find((r) => r.id === role);

  useEffect(() => {
    if (list.length === 1) setProfessionalId(list[0].id);
    else setProfessionalId("");
  }, [role, list]);

  async function send() {
    if (!role) return;
    if (!professionalId) { setMsg("Escolha o profissional."); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${encodeURIComponent(emailParam)}/care-refer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ role, professionalId, reason: reason.trim() || null, patientName: patientName || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível encaminhar.");
      const who = list.find((p) => p.id === professionalId)?.name || meta?.label;
      setMsg(`${patientName || "Paciente"} encaminhado(a) para ${who}. O nome já aparece na área dela.`);
      setReason("");
      setRole(null);
      onDone?.();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-1"}`}>
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={role === r.id ? "btn-gold text-sm" : "btn-ghost text-sm"}
            onClick={() => { setRole(role === r.id ? null : r.id); setMsg(""); }}
          >
            Encaminhar {r.label.toLowerCase()}
          </button>
        ))}
      </div>

      {role && meta && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-[var(--border)] bg-white p-3">
          <p className="text-sm font-semibold text-[var(--text)]">
            Encaminhar {patientName ? <b>{patientName}</b> : "este paciente"} para {meta.label.toLowerCase()}
          </p>
          {list.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhuma {meta.label.toLowerCase()} na sua equipe ainda. Cadastre em{" "}
              <Link href="/medicos/equipe-assistencial" className="font-semibold text-[var(--gold)]">Minha Equipe</Link>.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{meta.label}</span>
                <select className="input-field" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                  {list.length > 1 && <option value="">Selecione</option>}
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.registry ? ` · ${meta.registry} ${p.registry}` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Motivo (opcional)</span>
                <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: ajuste de potássio, HAS, diabetes, ansiedade" />
              </label>
              <button type="button" className="btn-gold" onClick={send} disabled={saving || !professionalId}>
                {saving ? "Encaminhando…" : `Encaminhar para ${meta.label.toLowerCase()}`}
              </button>
            </>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}
