"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  listDigitalSignatureProviders,
  type DigitalSignatureProvider,
  type DigitalSignatureProviderId,
} from "@/lib/digital-signature/providers";
import {
  DIGITAL_SIGNED_LABEL,
  DIGITAL_UNSIGNED_LABEL,
} from "@/lib/digital-signature/status";
import {
  isLikelyMobile,
  shareOrDownloadPdf,
  whatsappUrl,
} from "@/lib/digital-signature/share";
import { toFriendlyMessage } from "@/lib/user-errors";

type Step = "choose" | DigitalSignatureProviderId | "done";

type SignedInfo = {
  id: string;
  pdfUrl: string;
  signedAt?: string | null;
};

type Props = {
  pdfHref?: string | null;
  pdfBlob?: Blob | null;
  filename?: string;
  documentId?: string | null;
  patientKey?: string | null;
  documentType?: string;
  title?: string;
  patientPhone?: string | null;
  compact?: boolean;
  alreadySigned?: boolean;
  signedDocumentId?: string | null;
  onSigned?: (info: SignedInfo) => void;
};

const PROVIDERS = listDigitalSignatureProviders();

function pdfName(type?: string, title?: string) {
  const base = (title || type || "documento-meurim")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "documento-meurim"}.pdf`;
}

export function SignDocumentPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<Step>("choose");
  const signed = props.alreadySigned || Boolean(props.signedDocumentId);

  function openAs(step: Step) {
    setStart(step);
    setOpen(true);
  }

  return (
    <div className={props.compact ? "mt-2" : "mt-4"}>
      <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--gold)]">Assinar documento</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text)]">
            {signed ? `✅ ${DIGITAL_SIGNED_LABEL}` : DIGITAL_UNSIGNED_LABEL}
          </p>
        </div>
        {!signed && (
          <>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              A assinatura acontece no VIDaaS ou nos serviços oficiais do CFM — o Meu Rim não guarda senha, PIN nem certificado.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={p.primary ? "btn-gold text-sm" : "btn-ghost text-sm"}
                  onClick={() => openAs(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => openAs("choose")}>
                Assinar digitalmente
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  void shareOrDownloadPdf({
                    blob: props.pdfBlob,
                    href: props.pdfHref,
                    filename: props.filename || pdfName(props.documentType, props.title),
                    title: props.title || "Documento Meu Rim",
                    prefer: "download",
                  });
                }}
              >
                Baixar PDF sem assinatura
              </button>
            </div>
          </>
        )}
        {signed && (
          <PostSignActions
            pdfHref={props.signedDocumentId ? `/api/documents/${props.signedDocumentId}/pdf` : props.pdfHref}
            pdfBlob={props.pdfBlob}
            filename={props.filename || pdfName(props.documentType, props.title)}
            title={props.title || "Documento Meu Rim"}
            documentId={props.signedDocumentId || props.documentId}
            patientPhone={props.patientPhone}
            saved
          />
        )}
      </div>
      {open && (
        <SignDocumentModal
          {...props}
          initialStep={start}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function SignDocumentModal(
  props: Props & { initialStep: Step; onClose: () => void }
) {
  const titleId = useId();
  const [step, setStep] = useState<Step>(props.initialStep);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [signed, setSigned] = useState<SignedInfo | null>(
    props.signedDocumentId ? { id: props.signedDocumentId, pdfUrl: `/api/documents/${props.signedDocumentId}/pdf` } : null
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const canAttach = Boolean(props.documentId || props.patientKey);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  const filename = props.filename || pdfName(props.documentType, props.title);
  const title = props.title || "Documento Meu Rim";

  async function handoff(prefer: "share" | "download" | "open") {
    setBusy(true);
    setMsg("");
    try {
      const result = await shareOrDownloadPdf({
        blob: props.pdfBlob,
        href: props.pdfHref,
        filename,
        title,
        text: `${title} — assine com seu certificado digital e volte ao Meu Rim para anexar o PDF.`,
        prefer,
      });
      if (result === "shared") setMsg("PDF enviado para o compartilhamento do aparelho.");
      else if (result === "downloaded") setMsg("PDF baixado. Assine no VIDaaS / Connect e volte para anexar.");
      else if (result === "opened") setMsg("PDF aberto. Assine e volte para anexar o arquivo.");
    } catch (e) {
      setMsg(toFriendlyMessage(e, "Não foi possível preparar o PDF."));
    } finally {
      setBusy(false);
    }
  }

  async function choose(id: DigitalSignatureProviderId) {
    setStep(id);
    setMsg("");
    if (id === "vidaas") {
      await handoff(isLikelyMobile() ? "share" : "download");
    }
  }

  async function attach(file: File, provider: DigitalSignatureProviderId) {
    if (!canAttach) {
      setMsg("Este PDF avulso não está ligado a um paciente. Abra o compositor do prontuário para guardar o assinado.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("provider", provider);
      if (props.patientKey) form.append("patientKey", props.patientKey);
      if (props.documentType) form.append("type", props.documentType);
      if (props.title) form.append("title", props.title);
      const url = props.documentId
        ? `/api/documents/${props.documentId}/signed-pdf`
        : "/api/documents/import-signed";
      const res = await fetch(url, { method: "POST", credentials: "include", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        pdfUrl?: string;
        signedAt?: string;
      };
      if (!res.ok || !data.id) throw new Error(data.error || "Não foi possível guardar o PDF assinado.");
      const info: SignedInfo = {
        id: data.id,
        pdfUrl: data.pdfUrl || `/api/documents/${data.id}/pdf`,
        signedAt: data.signedAt,
      };
      setSigned(info);
      setStep("done");
      props.onSigned?.(info);
    } catch (e) {
      setMsg(toFriendlyMessage(e, "Não foi possível guardar o PDF assinado."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const provider = step === "cfm" || step === "vidaas" ? PROVIDERS.find((p) => p.id === step) : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5" onClick={props.onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-[var(--shadow)] sm:rounded-[24px] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--gold)]">Assinar documento</p>
            <h2 id={titleId} className="font-display text-xl font-extrabold text-[var(--text)]">
              {step === "done" ? DIGITAL_SIGNED_LABEL : step === "choose" ? "Como deseja assinar?" : provider?.label}
            </h2>
          </div>
          <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={props.onClose} aria-label="Fechar">
            Fechar
          </button>
        </div>

        {step === "choose" && (
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                className={`flex w-full flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${
                  p.primary
                    ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                    : "border-[var(--border)] bg-white hover:border-[var(--border-gold)]"
                }`}
                onClick={() => void choose(p.id)}
              >
                <span className="text-sm font-extrabold text-[var(--text)]">{p.label}</span>
                <span className="mt-0.5 text-xs text-[var(--text-muted)]">{p.headline}</span>
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost mt-2 w-full text-sm"
              disabled={busy}
              onClick={() => void handoff("download")}
            >
              Baixar PDF sem assinatura
            </button>
          </div>
        )}

        {provider && (
          <ProviderStep
            provider={provider}
            busy={busy}
            canAttach={canAttach}
            fileRef={fileRef}
            onHandoff={handoff}
            onAttach={(file) => void attach(file, provider.id)}
            onBack={() => setStep("choose")}
          />
        )}

        {step === "done" && signed && (
          <div>
            <p className="text-sm text-[var(--text-soft)]">
              PDF assinado guardado no prontuário. Original permanece. Compartilhe com o paciente quando quiser.
            </p>
            <PostSignActions
              pdfHref={signed.pdfUrl}
              filename={filename.replace(/\.pdf$/i, "-assinado.pdf")}
              title={title}
              documentId={signed.id}
              patientPhone={props.patientPhone}
              saved
            />
          </div>
        )}

        {msg && (
          <p className="mt-3 text-sm font-semibold text-[var(--gold)]" role="status">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

function ProviderStep({
  provider,
  busy,
  canAttach,
  fileRef,
  onHandoff,
  onAttach,
  onBack,
}: {
  provider: DigitalSignatureProvider;
  busy: boolean;
  canAttach: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onHandoff: (prefer: "share" | "download" | "open") => void;
  onAttach: (file: File) => void;
  onBack: () => void;
}) {
  const mobile = isLikelyMobile();
  return (
    <div>
      <p className="text-sm text-[var(--text-soft)]">{provider.description}</p>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{mobile ? provider.mobileHint : provider.desktopHint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-gold text-sm"
          disabled={busy}
          onClick={() => onHandoff(mobile ? "share" : "download")}
        >
          {mobile ? "Abrir / compartilhar PDF" : "Baixar / abrir PDF"}
        </button>
        {!mobile && (
          <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => onHandoff("open")}>
            Abrir PDF
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {provider.officialLinks.map((link) => (
          <a key={link.id} className="btn-ghost text-sm" href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        ))}
      </div>
      <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {provider.honesty}
      </p>
      <div className="mt-4 rounded-2xl border border-[var(--border)] p-3">
        <p className="text-sm font-extrabold text-[var(--text)]">Já assinei — anexar PDF</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Volte ao Meu Rim e envie o arquivo assinado. Guardamos original + assinado, data, médico e CRM.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="mt-3 block w-full text-sm"
          disabled={busy || !canAttach}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttach(file);
          }}
        />
        {!canAttach && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Para salvar no prontuário, gere o documento a partir do paciente.
          </p>
        )}
      </div>
      <button type="button" className="btn-ghost mt-3 text-sm" onClick={onBack} disabled={busy}>
        ← Outra forma de assinar
      </button>
    </div>
  );
}

function PostSignActions({
  pdfHref,
  pdfBlob,
  filename,
  title,
  documentId,
  patientPhone,
  saved,
}: {
  pdfHref?: string | null;
  pdfBlob?: Blob | null;
  filename: string;
  title: string;
  documentId?: string | null;
  patientPhone?: string | null;
  saved?: boolean;
}) {
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const href = documentId ? `/api/documents/${documentId}/pdf` : pdfHref;

  async function sendToPatient() {
    if (!documentId) {
      setMsg("Guarde o PDF no prontuário para enviar ao paciente.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/documents/${documentId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: true }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "Não foi possível enviar ao paciente.");
      return;
    }
    setSent(true);
    setMsg("Disponibilizado na área do paciente.");
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-gold text-sm" onClick={() => void sendToPatient()} disabled={busy || sent}>
          {sent ? "Enviado ao paciente" : "Enviar ao paciente"}
        </button>
        <a
          className="btn-ghost text-sm"
          href={whatsappUrl(`${title} — documento assinado digitalmente no Meu Rim.`, patientPhone)}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() =>
            void shareOrDownloadPdf({
              blob: pdfBlob,
              href,
              filename,
              title,
              text: `${title} — assinado digitalmente.`,
              prefer: "share",
            })
          }
        >
          Compartilhar
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() =>
            void shareOrDownloadPdf({
              blob: pdfBlob,
              href,
              filename,
              title,
              prefer: "download",
            })
          }
        >
          Baixar PDF
        </button>
        <button type="button" className="btn-ghost text-sm" disabled={saved}>
          {saved ? "Salvo no prontuário" : "Salvar no prontuário"}
        </button>
      </div>
      {msg && <p className="text-xs font-semibold text-[var(--gold)]">{msg}</p>}
    </div>
  );
}
