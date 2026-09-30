"use client";

import { useRef, useState } from "react";
import {
  CFM_DOWNLOAD_BUTTON,
  CFM_PRESCRICAO_URL,
  CFM_SIGN_BUTTON,
  CFM_SIGN_HELP,
} from "@/lib/digital-signature/cfm-flow";
import { shareOrDownloadPdf } from "@/lib/digital-signature/share";
import { toFriendlyMessage } from "@/lib/user-errors";

type SignedInfo = { id: string; pdfUrl: string; signedAt?: string | null };

type Props = {
  pdfHref?: string | null;
  pdfBlob?: Blob | null;
  filename?: string;
  title?: string;
  documentId?: string | null;
  patientKey?: string | null;
  documentType?: string;
  compact?: boolean;
  alreadySigned?: boolean;
  onSigned?: (info: SignedInfo) => void;
};

function pdfName(type?: string, title?: string) {
  const base = (title || type || "documento-meurim")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "documento-meurim"}.pdf`;
}

/** Fluxo padrão: Baixar PDF + Assinar no CFM + anexar o assinado no prontuário. */
export function CfmPdfActions({
  pdfHref,
  pdfBlob,
  filename,
  title,
  documentId,
  patientKey,
  documentType,
  compact,
  alreadySigned,
  onSigned,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const name = filename || pdfName(documentType, title);
  const label = title || "Documento Meu Rim";
  const canAttach = Boolean(documentId || patientKey);
  const ready = Boolean(pdfBlob || pdfHref);

  async function downloadPdf() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await shareOrDownloadPdf({
        blob: pdfBlob,
        href: pdfHref,
        filename: name,
        title: label,
        prefer: "download",
      });
      setMsg("PDF baixado. Abra ‘Assinar no CFM’ e anexe o arquivo no portal oficial.");
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível baixar o PDF. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  async function attach(file: File) {
    if (!canAttach) {
      setErr("Este PDF avulso não está ligado a um paciente. Gere o documento no prontuário para guardar o assinado.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("provider", "cfm");
      if (patientKey) form.append("patientKey", patientKey);
      if (documentType) form.append("type", documentType);
      if (title) form.append("title", title);
      const url = documentId ? `/api/documents/${documentId}/signed-pdf` : "/api/documents/import-signed";
      const res = await fetch(url, { method: "POST", credentials: "include", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string; pdfUrl?: string; signedAt?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "Não foi possível guardar o PDF assinado.");
      setMsg("PDF assinado guardado no prontuário.");
      onSigned?.({ id: data.id, pdfUrl: data.pdfUrl || `/api/documents/${data.id}/pdf`, signedAt: data.signedAt });
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível guardar o PDF assinado."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "mt-2 space-y-2" : "mt-3 space-y-2"}>
      <p className="text-xs text-[var(--text-muted)]">{CFM_SIGN_HELP}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost text-sm" disabled={busy || !ready} onClick={() => void downloadPdf()}>
          {busy ? "Preparando…" : CFM_DOWNLOAD_BUTTON}
        </button>
        <a
          className="btn-gold text-sm"
          href={CFM_PRESCRICAO_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {CFM_SIGN_BUTTON}
        </a>
      </div>
      {canAttach && !alreadySigned && (
        <div className="rounded-xl border border-[var(--border)] bg-white/70 px-3 py-2">
          <p className="text-xs font-semibold text-[var(--text)]">Já assinei no CFM — anexar PDF</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            Depois de assinar no site oficial, envie o arquivo de volta. O Meu Rim não guarda senha nem certificado.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="mt-2 block w-full text-sm"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void attach(file);
            }}
          />
        </div>
      )}
      {err && (
        <p className="text-sm font-semibold text-[var(--danger)]" role="alert">
          {err}
        </p>
      )}
      {msg && (
        <p className="text-sm font-semibold text-[var(--gold)]" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Download autenticado (cookie da sessão). O atributo download no &lt;a&gt; falha no celular. */
export function DownloadPdfButton({
  href,
  filename,
  className,
  children,
}: {
  href: string;
  filename?: string;
  className?: string;
  children?: string;
}) {
  const [err, setErr] = useState("");
  async function run() {
    setErr("");
    try {
      await shareOrDownloadPdf({
        href,
        filename: filename || "documento-meurim.pdf",
        title: filename || "Documento",
        prefer: "download",
      });
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível baixar o PDF. Tente de novo."));
    }
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" className={className || "btn-ghost text-sm"} onClick={() => void run()}>
        {children || CFM_DOWNLOAD_BUTTON}
      </button>
      {err && <span className="mt-1 text-xs text-[var(--danger)]">{err}</span>}
    </span>
  );
}
