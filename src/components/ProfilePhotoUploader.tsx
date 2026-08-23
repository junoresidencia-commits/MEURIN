"use client";

import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/image-data-url";
import { toFriendlyMessage } from "@/lib/user-errors";

type Props = {
  /** GET → { photoUrl } e DELETE. POST { photo } → { photoUrl }. */
  endpoint: string;
  label?: string;
  hint?: string;
  /** Iniciais exibidas quando não há foto. */
  fallback?: string;
  /** Notifica o container quando a foto muda (ex.: atualizar avatar no header). */
  onChange?: (url: string | null) => void;
};

export function ProfilePhotoUploader({ endpoint, label = "Foto de perfil", hint, fallback = "?", onChange }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : { photoUrl: null }))
      .then((d) => { if (alive) setPhoto(d.photoUrl || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [endpoint]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Selecione uma imagem (PNG, JPG ou WEBP)."); return; }
    setErr("");
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file, 320);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar a foto.");
      const url = data.photoUrl || dataUrl;
      setPhoto(url);
      onChange?.(url);
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível enviar a foto."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Não foi possível remover a foto.");
      setPhoto(null);
      onChange?.(null);
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível remover a foto."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{label}</p>
      {hint && <p className="mt-1 text-sm text-[var(--text-soft)]">{hint}</p>}
      <div className="mt-3 flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Sua foto" className="h-16 w-16 shrink-0 rounded-full border border-[var(--border)] object-cover" />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-lg font-bold text-[var(--gold)]">{fallback.slice(0, 2).toUpperCase()}</span>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-ghost min-h-[40px] px-4 text-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Enviando…" : photo ? "Trocar foto" : "Adicionar foto"}
          </button>
          {photo && !busy && (
            <button type="button" className="text-xs font-semibold text-[var(--danger)]" onClick={remove}>Remover foto</button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPick} />
      </div>
      {err && <p className="mt-2 text-sm text-[var(--danger)]">{err}</p>}
    </div>
  );
}
