"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR Code (imagem PNG) de uma URL, com botões de baixar/compartilhar/copiar link.
 *  Contém SOMENTE a URL — nunca CPF, senha ou dados pessoais. */
export function QrCode({ value, size = 220, caption }: { value: string; size?: number; caption?: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (alive) setDataUrl(url); })
      .catch(() => { if (alive) setDataUrl(""); });
    return () => { alive = false; };
  }, [value, size]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "meu-rim-qrcode.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function share() {
    try {
      if (dataUrl && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "meu-rim-qrcode.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Meu Rim", text: "Acesse o Meu Rim" });
          return;
        }
      }
      if (navigator.share) { await navigator.share({ title: "Meu Rim", url: value }); return; }
    } catch { /* cancelado/sem suporte */ }
    copyLink();
  }
  function copyLink() { navigator.clipboard?.writeText(value); setMsg("Link copiado!"); setTimeout(() => setMsg(""), 1500); }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-white p-4">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR Code do Meu Rim" width={size} height={size} className="rounded-lg" />
      ) : (
        <div className="grid place-items-center rounded-lg bg-[var(--bg)] text-xs text-[var(--text-muted)]" style={{ width: size, height: size }}>Gerando…</div>
      )}
      <p className="break-all text-center text-[11px] text-[var(--text-muted)]">{caption || value}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={download}>Baixar QR Code</button>
        <button type="button" className="btn-ghost text-sm" onClick={share}>Compartilhar</button>
        <button type="button" className="btn-ghost text-sm" onClick={copyLink}>Copiar link</button>
      </div>
      {msg && <p className="text-xs font-semibold text-[var(--green,#0d9488)]">{msg}</p>}
    </div>
  );
}
