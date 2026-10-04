"use client";

import { useState } from "react";
import { postJson } from "@/lib/user-errors";

export function StartCareCallButton({
  patientKey,
  className,
  label = "Iniciar consulta online",
}: {
  patientKey: string;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [isReturn, setIsReturn] = useState(false);

  async function start() {
    setBusy(true);
    setErr("");
    try {
      const data = await postJson<{ meetingRoomId?: string }>("/api/care-rooms", { patientKey, isReturn }, "Não foi possível abrir a sala.");
      if (!data.meetingRoomId) throw new Error("Não foi possível abrir a sala.");
      window.location.href = `/consulta/${data.meetingRoomId}`;
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Não foi possível abrir a sala.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <label className="mb-2 flex items-center gap-2 text-sm text-[var(--text-soft)]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--gold)]"
          checked={isReturn}
          onChange={(e) => setIsReturn(e.target.checked)}
        />
        É um retorno (usa o valor do retorno; 0 = grátis)
      </label>
      <button type="button" className="btn-gold" onClick={() => void start()} disabled={busy}>
        {busy ? "Abrindo sala…" : isReturn ? "Iniciar retorno online" : label}
      </button>
      {err && <p className="mt-2 text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
