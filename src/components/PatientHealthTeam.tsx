"use client";

import { useEffect, useState } from "react";

type Team = {
  nephrologist: { name: string; crm?: string; specialty?: string } | null;
  team: { role: string; name: string; registry?: string }[];
};

const ROLE: Record<string, string> = {
  nutrition: "Nutricionista",
  psychology: "Psicólogo(a)",
  nursing: "Enfermeiro(a)",
};

export function PatientHealthTeam() {
  const [data, setData] = useState<Team | null>(null);
  useEffect(() => {
    fetch("/api/patient/care-team").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);
  if (!data) return null;
  const hasTeam = data.nephrologist || (data.team && data.team.length > 0);
  if (!hasTeam) return null;

  return (
    <section className="panel mt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Minha Equipe de Saúde</p>
      <div className="mt-2 space-y-2">
        {data.nephrologist && (
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">Nefrologista</p>
            <p className="font-semibold text-[var(--text)]">{data.nephrologist.name}</p>
          </div>
        )}
        {data.team.map((m, i) => (
          <div key={m.role + i}>
            <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">{ROLE[m.role] || m.role}</p>
            <p className="font-semibold text-[var(--text)]">{m.name}{m.registry ? <span className="ml-1 text-sm font-normal text-[var(--text-muted)]">{m.registry}</span> : null}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
