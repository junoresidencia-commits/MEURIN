"use client";

import { useState } from "react";
import { EncaminharPacienteForm } from "@/components/EncaminharPacienteForm";

export function EncaminharHeaderButton({
  emailParam,
  patientName,
  className = "btn-gold text-sm",
}: {
  emailParam: string;
  patientName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Encaminhar paciente
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="encaminhar-titulo">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-[var(--shadow)] sm:rounded-[24px] sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <p id="encaminhar-titulo" className="font-display text-lg font-extrabold text-[var(--text)]">
                Encaminhar paciente
              </p>
              <button type="button" onClick={() => setOpen(false)} className="text-2xl leading-none text-[var(--text-muted)]" aria-label="Fechar">
                ×
              </button>
            </div>
            <EncaminharPacienteForm
              emailParam={emailParam}
              patientName={patientName}
              onDone={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
