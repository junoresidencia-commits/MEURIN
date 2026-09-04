"use client";

import { useState } from "react";
import { EncaminharPacienteForm } from "@/components/EncaminharPacienteForm";

type Destino = "medico" | "assistencial";

/**
 * Um único Encaminhar no topo do prontuário: o médico escolhe se é
 * para outro médico da equipe ou para a equipe assistencial.
 */
export function EncaminharHeaderButton({
  emailParam,
  patientName,
}: {
  emailParam: string;
  patientName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [destino, setDestino] = useState<Destino | null>(null);

  function close() {
    setOpen(false);
    setDestino(null);
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost text-sm"
        onClick={() => {
          setDestino(null);
          setOpen(true);
        }}
      >
        Encaminhar
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="encaminhar-titulo">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-[var(--shadow)] sm:rounded-[24px] sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <p id="encaminhar-titulo" className="font-display text-lg font-extrabold text-[var(--text)]">
                Encaminhar
              </p>
              <button type="button" onClick={close} className="text-2xl leading-none text-[var(--text-muted)]" aria-label="Fechar">
                ×
              </button>
            </div>

            {!destino && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-soft)]">
                  Para quem você quer encaminhar {patientName || "este paciente"}?
                </p>
                <button
                  type="button"
                  className="w-full rounded-[20px] border border-[var(--border)] p-4 text-left transition hover:border-[var(--gold)]"
                  onClick={() => setDestino("medico")}
                >
                  <span className="block text-sm font-extrabold text-[var(--text)]">Médico da equipe</span>
                  <span className="mt-0.5 block text-sm text-[var(--text-muted)]">Cardiologista, endocrinologista, outro nefrologista…</span>
                </button>
                <button
                  type="button"
                  className="w-full rounded-[20px] border border-[var(--border)] p-4 text-left transition hover:border-[var(--gold)]"
                  onClick={() => setDestino("assistencial")}
                >
                  <span className="block text-sm font-extrabold text-[var(--text)]">Equipe assistencial</span>
                  <span className="mt-0.5 block text-sm text-[var(--text-muted)]">Nutrição, psicologia ou enfermagem</span>
                </button>
              </div>
            )}

            {destino && (
              <div>
                <button type="button" className="mb-3 text-sm font-semibold text-[var(--gold)]" onClick={() => setDestino(null)}>
                  ← Voltar
                </button>
                <EncaminharPacienteForm
                  emailParam={emailParam}
                  patientName={patientName}
                  restrict={destino}
                  onDone={close}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
