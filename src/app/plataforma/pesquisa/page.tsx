"use client";

import { useEffect, useState } from "react";
import { ETHICS_LABEL, type EthicsStatus } from "@/lib/research-governance";

type Row = {
  studyId: string;
  studyTitle: string;
  ethicsStatus: EthicsStatus;
  protocolCode: string | null;
  ethicsBody: string | null;
  updatedAt: string;
};

export default function PlataformaPesquisaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/plataforma/pesquisa")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.protocols || []);
        setNote(d.note || "");
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Pesquisa — governança</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Só metadados éticos. Sem prontuário, sem CPF, sem financeiro da clínica.
      </p>
      {note && <p className="mt-2 text-sm text-[var(--text-soft)]">{note}</p>}
      <div className="mt-5 grid gap-3">
        {rows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum protocolo registrado ainda.</p>}
        {rows.map((r) => (
          <div key={r.studyId} className="panel">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              {ETHICS_LABEL[r.ethicsStatus] || r.ethicsStatus}
            </p>
            <p className="font-bold text-[var(--text)]">{r.studyTitle}</p>
            <p className="text-sm text-[var(--text-muted)]">
              {r.protocolCode || "Sem número"} {r.ethicsBody ? `· ${r.ethicsBody}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
