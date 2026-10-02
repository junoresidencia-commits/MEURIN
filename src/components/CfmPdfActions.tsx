"use client";

import { useEffect, useRef, useState } from "react";
import {
  CFM_DOWNLOAD_BUTTON,
  CFM_PRESCRICAO_URL,
  CFM_SIGN_BUTTON,
  CFM_SIGN_HELP,
} from "@/lib/digital-signature/cfm-flow";
import { shareOrDownloadPdf } from "@/lib/digital-signature/share";
import { printHref } from "@/lib/print-pdf";
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
  onLargerType?: () => void;
  largerTypeLabel?: string;
  onDigitalSign?: () => void;
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

const BTN = "min-h-12 min-w-[8.5rem] px-4 text-sm sm:min-h-[52px]";

/** Fluxo padrão: visualizar, baixar, imprimir, compartilhar e Assinar no CFM. */
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
  onLargerType,
  largerTypeLabel,
  onDigitalSign,
}: Props) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [viewer, setViewer] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!viewer || pdfHref || !pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [viewer, pdfHref, pdfBlob]);
  const name = filename || pdfName(documentType, title);
  const label = title || "Documento Meu Rim";
  const canAttach = Boolean(documentId || patientKey);
  const ready = Boolean(pdfBlob || pdfHref);
  const printUrl = pdfHref ? printHref(pdfHref) : "";

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setErr("");
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível concluir. Tente de novo."));
    } finally {
      setBusy("");
    }
  }

  async function downloadPdf() {
    await shareOrDownloadPdf({
      blob: pdfBlob,
      href: pdfHref,
      filename: name,
      title: label,
      prefer: "download",
    });
    setMsg("PDF baixado. Clique em ‘Assinar no CFM’ e anexe o arquivo no portal oficial.");
  }

  async function viewPdf() {
    if (pdfHref || pdfBlob) {
      setViewer(true);
      return;
    }
    await shareOrDownloadPdf({
      blob: pdfBlob,
      href: pdfHref,
      filename: name,
      title: label,
      prefer: "open",
    });
  }

  function largerType() {
    const next = zoom >= 1.3 ? 1 : Number((zoom + 0.15).toFixed(2));
    setZoom(next);
    setViewer(true);
    onLargerType?.();
  }

  async function sharePdf() {
    const result = await shareOrDownloadPdf({
      blob: pdfBlob,
      href: pdfHref,
      filename: name,
      title: label,
      text: `${label} — documento Meu Rim.`,
      prefer: "share",
    });
    if (result === "shared") setMsg("PDF enviado pelo compartilhamento do aparelho.");
    else if (result === "downloaded") setMsg("Este navegador não compartilha arquivo. O PDF foi baixado.");
  }

  function printPdf() {
    if (printUrl) {
      window.open(printUrl, "_blank", "noopener,noreferrer");
      return;
    }
    void run("print", async () => {
      await shareOrDownloadPdf({
        blob: pdfBlob,
        href: pdfHref,
        filename: name,
        title: label,
        prefer: "open",
      });
      setMsg("PDF aberto. Use Imprimir no visualizador.");
    });
  }

  async function downloadAndOpenCfm() {
    await downloadPdf();
    window.open(CFM_PRESCRICAO_URL, "_blank", "noopener,noreferrer");
    setMsg("PDF baixado e portal do CFM aberto. Anexe o arquivo no site oficial.");
  }

  async function attach(file: File) {
    if (!canAttach) {
      setErr("Este PDF avulso não está ligado a um paciente. Gere o documento no prontuário para guardar o assinado.");
      return;
    }
    setBusy("attach");
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
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "mt-2 space-y-2" : "mt-3 space-y-3"}>
      <p className="text-sm text-[var(--text-muted)]">{CFM_SIGN_HELP}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn-ghost ${BTN}`} disabled={Boolean(busy) || !ready} onClick={() => void run("view", viewPdf)}>
          {busy === "view" ? "Abrindo…" : "Visualizar"}
        </button>
        <button type="button" className={`btn-ghost ${BTN}`} disabled={Boolean(busy) || !ready} onClick={() => void run("down", downloadPdf)}>
          {busy === "down" ? "Preparando…" : CFM_DOWNLOAD_BUTTON}
        </button>
        <button type="button" className={`btn-ghost ${BTN}`} disabled={Boolean(busy) || !ready} onClick={printPdf}>
          Imprimir
        </button>
        <button type="button" className={`btn-ghost ${BTN}`} disabled={Boolean(busy) || !ready} onClick={() => void run("share", sharePdf)}>
          {busy === "share" ? "Enviando…" : "Compartilhar"}
        </button>
        <button type="button" className={`btn-ghost ${BTN}`} disabled={Boolean(busy) || !ready} onClick={largerType}>
          {largerTypeLabel || (zoom > 1 ? `Letra ${Math.round(zoom * 100)}%` : "Aumentar letra")}
        </button>
        {onDigitalSign && (
          <button type="button" className={`btn-ghost ${BTN}`} disabled={Boolean(busy)} onClick={onDigitalSign}>
            Assinar digitalmente
          </button>
        )}
        <a className={`btn-gold ${BTN}`} href={CFM_PRESCRICAO_URL} target="_blank" rel="noopener noreferrer">
          {CFM_SIGN_BUTTON}
        </a>
        <button
          type="button"
          className={`btn-gold ${BTN}`}
          disabled={Boolean(busy) || !ready}
          onClick={() => void run("both", downloadAndOpenCfm)}
        >
          {busy === "both" ? "Preparando…" : "Baixar PDF e abrir CFM"}
        </button>
      </div>
      {canAttach && !alreadySigned && (
        <div className="rounded-xl border border-[var(--border)] bg-white/70 px-3 py-2">
          <p className="text-xs font-semibold text-[var(--text)]">Já assinei no CFM — anexar PDF</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            Depois de assinar no site oficial, envie o arquivo de volta. O Meu Rim não guarda senha, certificado nem token.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="mt-2 block w-full text-sm"
            disabled={Boolean(busy)}
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
      {viewer && ready && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-black/50 p-3 sm:p-6" onClick={() => setViewer(false)}>
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <p className="font-semibold text-[var(--text)]">Visualizar · {label}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`btn-ghost ${BTN}`} onClick={largerType}>
                  {zoom > 1 ? `Letra ${Math.round(zoom * 100)}%` : "Aumentar letra"}
                </button>
                <button type="button" className={`btn-ghost ${BTN}`} onClick={() => void run("view", async () => {
                  await shareOrDownloadPdf({ blob: pdfBlob, href: pdfHref, filename: name, title: label, prefer: "open" });
                })}>
                  Nova aba
                </button>
                <button type="button" className={`btn-ghost ${BTN}`} onClick={() => setViewer(false)}>
                  Fechar
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[var(--bg)]">
              {(pdfHref || blobUrl) ? (
                <iframe
                  title={label}
                  src={pdfHref || blobUrl || ""}
                  className="h-full min-h-[70vh] w-full origin-top-left border-0"
                  style={zoom > 1 ? { transform: `scale(${zoom})`, width: `${100 / zoom}%`, height: `${70 / zoom}vh` } : undefined}
                />
              ) : (
                <p className="p-4 text-sm text-[var(--text-muted)]">Use Nova aba para ver este PDF.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Download autenticado (cookie da sessão). O atributo download no âncora falha no celular. */
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
