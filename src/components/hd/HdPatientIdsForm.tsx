"use client";

import { useState } from "react";

type Cadastro = {
  cpf?: string | null;
  cns?: string | null;
  motherName?: string | null;
};

export function HdPatientIdsForm({
  patientId,
  initial,
  onSaved,
}: {
  patientId: string;
  initial: Cadastro;
  onSaved?: () => void;
}) {
  const [cpf, setCpf] = useState(initial.cpf || "");
  const [cns, setCns] = useState(initial.cns || "");
  const [motherName, setMotherName] = useState(initial.motherName || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_patient_ids", patientId, cpf, cns, motherName }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) {
      setMsg(d.error);
      return;
    }
    setMsg("Cadastro salvo. A LME usa CPF, Cartão do SUS e nome da mãe.");
    onSaved?.();
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        Nome da mãe
        <input
          className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2"
          value={motherName}
          onChange={(e) => setMotherName(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="text-sm">
        CPF
        <input
          className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          inputMode="numeric"
          placeholder="000.000.000-00"
        />
      </label>
      <label className="text-sm">
        Cartão do SUS (CNS)
        <input
          className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2"
          value={cns}
          onChange={(e) => setCns(e.target.value)}
          inputMode="numeric"
          placeholder="000 0000 0000 0000"
        />
      </label>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
        <button className="btn-gold" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar cadastro"}</button>
        {msg && <p className="text-sm text-[var(--gold)]">{msg}</p>}
      </div>
    </form>
  );
}
