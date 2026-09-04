"use client";

import { useCallback, useEffect, useState } from "react";
import { encodePatientParam } from "@/lib/user-errors";

type Share = {
  id: string;
  patientKey: string;
  fromDoctorId: string;
  fromDoctorName: string | null;
  fromSpecialty: string | null;
  toDoctorId: string;
  toDoctorName: string | null;
  toSpecialty: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
};

type Payload = {
  owner: { id: string; name: string; specialty: string; crm: string } | null;
  shares: Share[];
  audit: { id: string; doctorName: string | null; action: string; detail: string | null; createdAt: string }[];
};

const ACTION_LABEL: Record<string, string> = {
  compartilhou: "Compartilhou",
  revogou_acesso: "Removeu acesso",
  evolucao_criada: "Registrou evolução",
  documento_criado: "Criou documento",
};

export function SharePatientWithDoctor({ emailParam }: { emailParam: string; patientName?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/doctor/patients/${encodePatientParam(emailParam)}/shares`).then((r) => r.json());
    if (d.shares) setData(d);
  }, [emailParam]);

  useEffect(() => { load(); }, [load]);

  async function revoke(id: string, name: string) {
    if (!window.confirm(`Remover ${name} deste paciente? O histórico que essa pessoa registrou permanece no prontuário.`)) return;
    await fetch("/api/doctor/shares", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  }

  return (
    <div className="panel mt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Equipe médica</p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Quem já acompanha este prontuário. Para incluir alguém, use Encaminhar no topo.</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {data?.owner && (
          <p className="text-sm text-[var(--text)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Cadastro</span>
            <br />
            {data.owner.name} — {data.owner.specialty || "Medicina"}
          </p>
        )}
        {(data?.shares || []).length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Nenhum outro médico autorizado neste prontuário.</p>
        )}
        {(data?.shares || []).map((s) => (
          <div key={s.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--border)] pt-2">
            <div>
              <p className="font-semibold text-[var(--text)]">{s.toDoctorName} — {s.toSpecialty || "Medicina"}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Encaminhado por {s.fromDoctorName} {s.fromSpecialty ? `— ${s.fromSpecialty}` : ""} · {new Date(s.createdAt).toLocaleDateString("pt-BR")}
              </p>
              {s.reason && <p className="mt-1 text-sm text-[var(--text-soft)]"><b>Motivo:</b> {s.reason}</p>}
            </div>
            <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => revoke(s.id, s.toDoctorName || "profissional")}>
              Remover acesso
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="mt-3 text-xs font-semibold text-[var(--gold)]" onClick={() => setShowAudit((v) => !v)}>
        {showAudit ? "Ocultar histórico de acesso" : "Ver histórico de acesso"}
      </button>
      {showAudit && (
        <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
          {(data?.audit || []).length === 0 && <li>Nenhum registro ainda.</li>}
          {(data?.audit || []).map((a) => (
            <li key={a.id}>
              {new Date(a.createdAt).toLocaleString("pt-BR")} · {ACTION_LABEL[a.action] || a.action} · {a.doctorName}
              {a.detail ? ` — ${a.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
