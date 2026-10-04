"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PixQrPanel({
  brCode,
  pixKey,
  amountLabel,
}: {
  brCode: string;
  pixKey?: string;
  amountLabel?: string;
}) {
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!brCode) {
      setQr("");
      return;
    }
    let alive = true;
    QRCode.toDataURL(brCode, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        if (alive) setQr("");
      });
    return () => {
      alive = false;
    };
  }, [brCode]);

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text);
    setMsg(label);
    setTimeout(() => setMsg(""), 1600);
  }

  if (!brCode) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--gold-soft)]/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">PIX do profissional</p>
      {amountLabel && <p className="mt-1 text-sm text-[var(--text-soft)]">{amountLabel}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={() => setShow((v) => !v)}>
          {show ? "Ocultar QR Code" : "Mostrar QR Code"}
        </button>
        {pixKey && (
          <button type="button" className="btn-ghost text-sm" onClick={() => copy(pixKey, "Chave PIX copiada.")}>
            Copiar chave PIX
          </button>
        )}
        <button type="button" className="btn-ghost text-sm" onClick={() => copy(brCode, "PIX Copia e Cola copiado.")}>
          Copiar PIX Copia e Cola
        </button>
      </div>
      {show && (
        <div className="mt-3 flex flex-col items-start gap-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code PIX" width={180} height={180} className="rounded-lg bg-white p-1" />
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Gerando QR Code…</p>
          )}
          <p className="break-all font-mono text-[11px] text-[var(--text-soft)]">{brCode}</p>
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-[var(--green,#0d9488)]">{msg}</p>}
    </div>
  );
}
