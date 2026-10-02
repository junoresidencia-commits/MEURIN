"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/scheduling-client";

type PixInfo = {
  brCode: string;
  qrDataUrl: string;
  amountCents: number;
  holderName: string;
  doctorName?: string;
};

/** Pix com QR Code na chave cadastrada pelo médico. */
export function PixCheckout({
  pix,
  onPaid,
}: {
  pix: PixInfo;
  onPaid: () => Promise<void> | void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(pix.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Não foi possível copiar. Selecione o código e copie.");
    }
  }

  async function paid() {
    setBusy(true);
    setErr("");
    try {
      await onPaid();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Pix · pagamento direto</p>
        <p className="mt-1 text-2xl font-extrabold text-[var(--text)]">{formatBRL(pix.amountCents)}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Vai para <strong className="text-[var(--text)]">{pix.holderName || pix.doctorName}</strong>
        </p>
        {pix.qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pix.qrDataUrl}
            alt="QR Code Pix da consulta"
            width={260}
            height={260}
            className="mx-auto mt-3 h-auto w-full max-w-[260px] rounded-xl bg-white p-2"
          />
        ) : null}
        <p className="mt-2 text-xs text-[var(--text-muted)]">Abra o app do banco e aponte a câmera no QR Code.</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Pix copia e cola</p>
        <p className="break-all rounded-xl border border-[var(--border)] bg-white p-3 font-mono text-[11px] text-[var(--text-soft)]">
          {pix.brCode}
        </p>
        <button type="button" className="btn-ghost mt-2 min-h-12 w-full sm:w-auto" onClick={() => void copy()}>
          {copied ? "Código copiado" : "Copiar código Pix"}
        </button>
      </div>
      <button type="button" className="btn-gold min-h-12 w-full" disabled={busy} onClick={() => void paid()}>
        {busy ? "Confirmando…" : "Já paguei o Pix"}
      </button>
      {err && <p className="text-sm font-semibold text-[var(--danger)]">{err}</p>}
    </div>
  );
}
