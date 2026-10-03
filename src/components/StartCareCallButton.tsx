"use client";

import { useState } from "react";
import { toFriendlyMessage } from "@/lib/user-errors";

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

  async function start() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/care-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível abrir a sala.");
      window.location.href = `/consulta/${data.meetingRoomId}`;
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível abrir a sala."));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" className="btn-gold" onClick={() => void start()} disabled={busy}>
        {busy ? "Abrindo sala…" : label}
      </button>
      {err && <p className="mt-2 text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
