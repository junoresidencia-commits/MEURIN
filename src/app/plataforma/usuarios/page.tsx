"use client";

import { useEffect, useState } from "react";

type Doc = { id: string; name: string; email: string; crm: string; specialty: string; status: string; roles: string[] };

export default function UsuariosPage() {
  const [doctors, setDoctors] = useState<Doc[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/plataforma/doctors")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setDoctors(d.doctors || []);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Usuários</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Os IDs abaixo são os mesmos da área médica. Um médico em várias clínicas continua sendo um único usuário.
      </p>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {doctors && doctors.length === 0 && (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Nenhum médico cadastrado.</p>
      )}
      <div className="mt-4 space-y-2">
        {(doctors || []).map((d) => (
          <div key={d.id} className="panel">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">{d.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{d.id}</p>
            </div>
            <p className="text-sm text-[var(--text-soft)]">{d.email} · {d.crm} · {d.specialty}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--gold)]">
              {["MEDICO", ...d.roles].join(" + ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
