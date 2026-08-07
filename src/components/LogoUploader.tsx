"use client";

import { useEffect, useRef, useState } from "react";

/** Redimensiona a imagem no navegador para caber em `max` px (mantendo proporção). */
function fileToDataUrl(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const ratio = Math.min(max / width, max / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível."));
        ctx.drawImage(img, 0, 0, width, height);
        // PNG preserva transparência da logo.
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Gerencia a logo do médico exibida no cabeçalho dos documentos. */
export function LogoUploader() {
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/doctor/logo")
      .then((r) => (r.ok ? r.json() : { logoUrl: null }))
      .then((d) => setLogo(d.logoUrl || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setErr("");
    setMsg("");
    if (!file.type.startsWith("image/")) {
      setErr("Selecione um arquivo de imagem (PNG, JPG ou WEBP).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/doctor/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar a logo.");
      setLogo(data.logoUrl);
      setMsg("Logo salva. Ela aparecerá nos documentos e PDFs.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar a logo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/doctor/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Não foi possível remover a logo.");
      setLogo(null);
      setMsg("Logo removida.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao remover a logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Logo nos documentos</p>
      <p className="text-sm text-[var(--text-soft)]">
        Envie a logo do seu consultório. Ela aparece no cabeçalho das receitas, pedidos de exame e relatórios ao imprimir ou salvar em PDF.
      </p>

      <div className="flex items-center gap-4">
        <div className="grid h-16 w-28 place-items-center overflow-hidden rounded-xl border border-dashed border-[var(--border-gold)] bg-[var(--bg-soft)]">
          {loading ? (
            <span className="text-xs text-[var(--text-muted)]">…</span>
          ) : logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo atual" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-xs text-[var(--text-muted)]">Sem logo</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-gold"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Enviando…" : logo ? "Trocar logo" : "Enviar logo"}
          </button>
          {logo && (
            <button type="button" className="text-sm font-semibold text-[var(--danger)]" disabled={busy} onClick={remove}>
              Remover logo
            </button>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPick} />
      {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
      {err && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
