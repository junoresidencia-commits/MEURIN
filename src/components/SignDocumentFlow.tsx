"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import QRCode from "qrcode";
import {
  listDigitalSignatureProviders,
  type DigitalSignatureProvider,
  type DigitalSignatureProviderId,
} from "@/lib/digital-signature/providers";
import { SIGNATURE_LINKS } from "@/lib/signature-links";
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

type Step = "choose" | DigitalSignatureProviderId | "manual" | "done";

type SignedInfo = {
  id: string;
  pdfUrl: string;
  signedAt?: string | null;
  kind?: "digital" | "manual";
};

export type SignContext = {
  patientName?: string | null;
  patientCpf?: string | null;
  doctorCrm?: string | null;
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
  alreadyManual?: boolean;
  signedDocumentId?: string | null;
  signContext?: SignContext | null;
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
  const signed = props.alreadySigned || Boolean(props.signedDocumentId && !props.alreadyManual);
  const manual = Boolean(props.alreadyManual) && !props.alreadySigned;

  function startSession(action: "manual_start" | "digital_start") {
    if (!props.documentId) return;
    void fetch("/api/document-workflow/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: props.documentId, action }),
    });
  }

  function openAs(step: Step) {
    if (step === "vidaas") startSession("digital_start");
    if (step === "manual") startSession("manual_start");
    setStart(step);
    setOpen(true);
  }

  return (
    <div className={props.compact ? "mt-2" : "mt-4"}>
      <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--gold)]">Assinar documento</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text)]">
            {signed ? `🟢 ${DIGITAL_SIGNED_LABEL}` : manual ? "🔵 Assinatura manual registrada" : DIGITAL_UNSIGNED_LABEL}
          </p>
        </div>
        {!signed && !manual && (
          <>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              A assinatura digital usa o certificado ICP-Brasil no VIDaaS. O Meu Rim não guarda senha, PIN nem certificado.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button type="button" className="btn-gold text-sm" onClick={() => openAs("vidaas")}>
                Assinar digitalmente
              </button>
              <button type="button" className="btn-ghost text-sm" onClick={() => openAs("manual")}>
                Baixar / imprimir para assinar manualmente
              </button>
              <button type="button" className="btn-ghost text-sm" onClick={() => openAs("cfm")}>
                Abrir CFM
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => openAs("choose")}>
                Outras opções
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
                Baixar PDF sem marcar como assinado
              </button>
            </div>
          </>
        )}
        {(signed || manual) && (
          <PostSignActions
            pdfHref={props.signedDocumentId ? `/api/documents/${props.signedDocumentId}/pdf` : props.pdfHref}
            pdfBlob={props.pdfBlob}
            filename={props.filename || pdfName(props.documentType, props.title)}
            title={props.title || "Documento Meu Rim"}
            documentId={props.signedDocumentId || props.documentId}
            patientPhone={props.patientPhone}
            saved
            kind={signed ? "digital" : "manual"}
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
  const [signedKind, setSignedKind] = useState<"digital" | "manual">(props.alreadyManual ? "manual" : "digital");
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
  }

  async function attach(file: File, provider: DigitalSignatureProviderId | "manual") {
    if (!canAttach) {
      setMsg("Este PDF avulso não está ligado a um paciente. Abra o compositor do prontuário para guardar o assinado.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("provider", provider === "manual" ? "vidaas" : provider);
      if (provider === "manual") form.append("method", "manual");
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
        kind: provider === "manual" ? "manual" : "digital",
      };
      setSignedKind(info.kind || "digital");
      setSigned(info);
      setStep("done");
      props.onSigned?.(info);
    } catch (e) {
      const base = toFriendlyMessage(e, "Não foi possível guardar o PDF assinado.");
      setMsg(
        provider === "manual"
          ? `${base} O documento original continua salvo. Tente anexar de novo ou baixe o PDF.`
          : `Assinatura digital não foi concluída. Seu documento continua salvo. Você pode tentar novamente, assinar manualmente ou baixar o PDF. ${base}`,
      );
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
              {step === "done"
                ? signedKind === "manual"
                  ? "Assinatura manual registrada"
                  : DIGITAL_SIGNED_LABEL
                : step === "manual"
                  ? "Assinatura manual"
                  : step === "choose"
                    ? "Como deseja assinar?"
                    : provider?.label}
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
              onClick={() => setStep("manual")}
            >
              Baixar / imprimir para assinar manualmente
            </button>
            <button
              type="button"
              className="btn-ghost mt-2 w-full text-sm"
              disabled={busy}
              onClick={() => void handoff("download")}
            >
              Baixar PDF sem marcar como assinado
            </button>
          </div>
        )}

        {provider && (
          <ProviderStep
            provider={provider}
            busy={busy}
            canAttach={canAttach}
            fileRef={fileRef}
            signContext={props.signContext}
            onHandoff={handoff}
            onAttach={(file) => void attach(file, provider.id)}
            onBack={() => setStep("choose")}
          />
        )}

        {step === "manual" && (
          <ManualStep
            busy={busy}
            canAttach={canAttach}
            fileRef={fileRef}
            documentId={props.documentId}
            onHandoff={handoff}
            onAttach={(file) => void attach(file, "manual")}
            onBack={() => setStep("choose")}
          />
        )}

        {step === "done" && signed && (
          <div>
            <p className="text-sm text-[var(--text-soft)]">
              {signedKind === "manual"
                ? "Via digitalizada guardada. O PDF original gerado pelo Meu Rim permanece. Isto não é assinatura digital ICP-Brasil."
                : "PDF assinado digitalmente guardado no prontuário. Original permanece. Compartilhe com o paciente quando quiser."}
            </p>
            <PostSignActions
              pdfHref={signed.pdfUrl}
              filename={filename.replace(/\.pdf$/i, "-assinado.pdf")}
              title={title}
              documentId={signed.id}
              patientPhone={props.patientPhone}
              saved
              kind={signedKind}
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
  signContext,
  onHandoff,
  onAttach,
  onBack,
}: {
  provider: DigitalSignatureProvider;
  busy: boolean;
  canAttach: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  signContext?: SignContext | null;
  onHandoff: (prefer: "share" | "download" | "open") => void;
  onAttach: (file: File) => void;
  onBack: () => void;
}) {
  const mobile = isLikelyMobile();
  const gov = provider.officialLinks.find((l) => l.id === "gov-assinador");
  const cfm = provider.officialLinks.find((l) => l.id === "cfm-prescricao");
  const extra = provider.officialLinks.filter((l) => l.id !== "gov-assinador" && l.id !== "cfm-prescricao" && l.id !== "vidaas-info");
  const validShop = provider.officialLinks.find((l) => l.id === "vidaas-info");
  const paste = [
    signContext?.patientName ? `Paciente: ${signContext.patientName}` : "",
    signContext?.patientCpf ? `CPF: ${signContext.patientCpf}` : "",
    signContext?.doctorCrm ? `CRM: ${signContext.doctorCrm}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div>
      <p className="text-sm text-[var(--text-soft)]">{provider.description}</p>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-[var(--text-soft)]">
        <li>
          <b>Pegue este PDF</b>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-gold text-sm"
              disabled={busy}
              onClick={() => onHandoff(mobile ? "share" : "download")}
            >
              {mobile ? "Abrir / compartilhar PDF" : "Baixar este PDF"}
            </button>
            {!mobile && (
              <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => onHandoff("open")}>
                Abrir PDF
              </button>
            )}
          </div>
        </li>
        {provider.id === "vidaas" && (
          <li>
            <b>Envie o PDF no Assinador gov.br</b>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              É <em>aqui</em> que vai o arquivo — não na loja da Valid. Leia o QR no celular ou abra no computador.
            </p>
            <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <MiniQr value={SIGNATURE_LINKS.govAssinador} caption="Leia: Assinador gov.br" />
              {gov && (
                <a className="btn-gold text-sm" href={gov.href} target="_blank" rel="noopener noreferrer">
                  Abrir Assinador gov.br
                </a>
              )}
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Quando o gov.br pedir o certificado, leia o QR com o <b>app VIDaaS</b>.
            </p>
          </li>
        )}
        {provider.id === "cfm" && (
          <li>
            <b>Mande para o CFM (Prescrição eletrônica)</b>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Portal oficial do Conselho. Este PDF do Meu Rim não entra sozinho — abra o CFM, use os dados do paciente, ou
              assine o arquivo daqui no Assinador gov.br com o certificado da AR-CFM.
            </p>
            <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <MiniQr value={SIGNATURE_LINKS.cfmPrescricao} caption="Leia: Prescrição CFM" />
              {cfm && (
                <a className="btn-gold text-sm" href={cfm.href} target="_blank" rel="noopener noreferrer">
                  Abrir Prescrição eletrônica CFM
                </a>
              )}
            </div>
            {paste && (
              <CopyPatientBox text={paste} />
            )}
            <a className="btn-ghost mt-2 inline-block text-sm" href={SIGNATURE_LINKS.govAssinador} target="_blank" rel="noopener noreferrer">
              Assinar este PDF no Assinador gov.br
            </a>
          </li>
        )}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {extra.map((link) => (
          <a key={link.id} className="btn-ghost text-sm" href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        ))}
      </div>
      {validShop && (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          Ainda não tem certificado VIDaaS?{" "}
          <a className="font-semibold text-[var(--gold)]" href={validShop.href} target="_blank" rel="noopener noreferrer">
            Página da Valid (só para emitir — não recebe o PDF)
          </a>
        </p>
      )}
      <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {provider.honesty}
      </p>
      <div className="mt-4 rounded-2xl border-2 border-[var(--gold)] bg-[var(--gold-soft)] p-3">
        <p className="text-sm font-extrabold text-[var(--text)]">É aqui que você devolve o PDF assinado</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Depois de assinar no gov.br, VIDaaS ou CFM, volte e anexe o arquivo. Guardamos original + assinado, data, médico e CRM.
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

function ManualStep({
  busy,
  canAttach,
  fileRef,
  documentId,
  onHandoff,
  onAttach,
  onBack,
}: {
  busy: boolean;
  canAttach: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  documentId?: string | null;
  onHandoff: (prefer: "share" | "download" | "open") => void;
  onAttach: (file: File) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-[var(--text-soft)]">
        Baixar ou imprimir <b>não</b> marca o documento como assinado. Assine no papel e anexe a via digitalizada.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--text-soft)]">
        <li>Gere/baixe o PDF final (a versão fica congelada para auditoria).</li>
        <li>Assine à mão — médico, e paciente/responsável quando o documento exigir.</li>
        <li>Fotografe, digitalize ou anexe o PDF assinado abaixo.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-gold text-sm"
          disabled={busy}
          onClick={() => {
            if (documentId) {
              void fetch("/api/document-workflow/session", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId, action: "manual_start" }),
              });
            }
            onHandoff("download");
          }}
        >
          Baixar / imprimir PDF
        </button>
      </div>
      <div className="mt-4 rounded-2xl border-2 border-[var(--gold)] bg-[var(--gold-soft)] p-3">
        <p className="text-sm font-extrabold text-[var(--text)]">Anexar documento assinado</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          No celular: fotografar ou escolher arquivo. No computador: PDF digitalizado. O original gerado pelo Meu Rim permanece.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,image/jpeg,image/png,image/heic,image/webp"
          capture="environment"
          className="mt-3 block w-full text-sm"
          disabled={busy || !canAttach}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttach(file);
          }}
        />
        {!canAttach && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Para salvar no prontuário, gere o documento a partir do paciente.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Este fluxo registra <b>assinatura manual</b> — nunca o selo de assinatura digital ICP-Brasil.
      </p>
      <button type="button" className="btn-ghost mt-3 text-sm" onClick={onBack} disabled={busy}>
        ← Outra forma de assinar
      </button>
    </div>
  );
}

function MiniQr({ value, caption }: { value: string; caption: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: 132, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc("");
      });
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div className="flex w-[148px] flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-white p-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={caption} width={132} height={132} className="rounded-md" />
      ) : (
        <div className="grid h-[132px] w-[132px] place-items-center text-[11px] text-[var(--text-muted)]">QR…</div>
      )}
      <p className="text-center text-[10px] font-semibold text-[var(--text-muted)]">{caption}</p>
    </div>
  );
}

function CopyPatientBox({ text }: { text: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Dados para colar no CFM</p>
      <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--text)]">{text}</pre>
      <button
        type="button"
        className="btn-ghost mt-2 text-sm"
        onClick={() => {
          void navigator.clipboard?.writeText(text);
          setMsg("Copiado");
          window.setTimeout(() => setMsg(""), 1500);
        }}
      >
        {msg || "Copiar dados"}
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
  kind = "digital",
}: {
  pdfHref?: string | null;
  pdfBlob?: Blob | null;
  filename: string;
  title: string;
  documentId?: string | null;
  patientPhone?: string | null;
  saved?: boolean;
  kind?: "digital" | "manual";
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
          href={whatsappUrl(
            kind === "manual"
              ? `${title} — documento com assinatura manual registrada no Meu Rim.`
              : `${title} — documento assinado digitalmente no Meu Rim.`,
            patientPhone,
          )}
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
              text: kind === "manual" ? `${title} — assinatura manual registrada.` : `${title} — assinado digitalmente.`,
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
