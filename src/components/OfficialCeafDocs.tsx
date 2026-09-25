"use client";

import { useState, type ReactNode } from "react";
import { CEAF_PROTOCOLS, getProtocol } from "@/lib/ceaf-catalog";
import {
  getProtocolOfficialDocs,
  listAvailableOfficialDocs,
  type OfficialDocKind,
  type OfficialDocSlot,
} from "@/lib/ceaf-documents";
import { SignDocumentPanel } from "@/components/SignDocumentFlow";

const USER_ERROR = "Não foi possível localizar o documento oficial deste protocolo. Tente novamente ou informe o suporte.";

type Props = {
  protocolId?: string;
  lmeId?: string;
  patientName?: string;
  doctorName?: string;
  crm?: string;
  patientCpf?: string;
  patientBirth?: string;
  patientKey?: string;
  meds?: string;
  service?: string;
  /** Mostra TER de todos os protocolos oficiais (página da LME / revisão). */
  showAllProtocols?: boolean;
};

function isPdfContentType(value: string | null) {
  return (value || "").toLowerCase().includes("application/pdf");
}

async function readApiError(res: Response) {
  const type = res.headers.get("content-type") || "";
  if (type.includes("json")) {
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) return data.error;
    } catch {
      /* usa mensagem padrão */
    }
  }
  return USER_ERROR;
}

export function OfficialCeafDocs({
  protocolId,
  lmeId,
  patientName,
  doctorName,
  crm,
  patientCpf,
  patientBirth,
  patientKey,
  meds,
  service,
  showAllProtocols = false,
}: Props) {
  const pack = protocolId ? getProtocolOfficialDocs(protocolId) : null;
  const protocolName = protocolId ? getProtocol(protocolId)?.name : undefined;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [lastPdf, setLastPdf] = useState<{ blob: Blob; name: string; kind: OfficialDocKind } | null>(null);
  const allTer = listAvailableOfficialDocs("ter");
  const allForm = listAvailableOfficialDocs("form");
  const listAll = showAllProtocols || !protocolId;

  async function openOfficial(doc: OfficialDocKind, pid?: string) {
    const proto = (pid || protocolId || "").trim();
    if (!proto && doc !== "residencia") {
      setError("Escolha o protocolo do TER.");
      return;
    }
    const key = `${doc}:${proto || "residencia"}`;
    setBusy(key);
    setError("");
    const params = new URLSearchParams({ protocol: proto || CEAF_PROTOCOLS[0]?.id || "", doc });
    if (lmeId) params.set("lmeId", lmeId);
    if (patientKey) params.set("patient", patientKey);
    if (meds) params.set("meds", meds);
    if (service) params.set("service", service);
    if (patientName) params.set("name", patientName);
    if (doctorName) params.set("doctor", doctorName);
    if (crm) params.set("crm", crm);
    if (patientCpf) params.set("cpf", patientCpf);
    if (patientBirth) params.set("birth", patientBirth);
    params.set("date", new Date().toLocaleDateString("pt-BR"));
    try {
      const res = await fetch(`/api/ceaf/official?${params}`, { credentials: "include" });
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !isPdfContentType(type)) {
        setError(await readApiError(res));
        return;
      }
      const blob = await res.blob();
      if (blob.size < 80 || blob.type.includes("json")) {
        setError(USER_ERROR);
        return;
      }
      const pdf = new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdf);
      const filename = `${doc}-${proto || "ceaf"}-oficial.pdf`;
      setLastPdf({ blob: pdf, name: filename, kind: doc });
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(USER_ERROR);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Termo de esclarecimento e responsabilidade (TER)
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        São as páginas oficiais da SESAB (pacote CEAF nefrologia). O Meu Rim preenche nome, CPF, médico e data quando o arquivo tem campo; não redesenha o termo.
        {protocolName ? ` Protocolo desta LME: ${protocolName}.` : ""}
      </p>

      {pack && (
        <div className="mt-2 flex flex-wrap gap-2">
          <OfficialButton slot={pack.ter} busy={busy.startsWith("ter:")} disabled={Boolean(busy)} onClick={() => openOfficial("ter", protocolId)}>
            {busy.startsWith("ter:") ? "Preparando documento…" : pack.ter.status === "available" ? pack.ter.label : "Baixar TER oficial (com nome)"}
          </OfficialButton>
          <OfficialButton slot={pack.form} busy={busy.startsWith("form:")} disabled={Boolean(busy)} onClick={() => openOfficial("form", protocolId)}>
            {busy.startsWith("form:") ? "Preparando documento…" : pack.form.status === "available" ? pack.form.label : "Baixar formulário oficial"}
          </OfficialButton>
          <OfficialButton slot={pack.residence} busy={busy.startsWith("residencia:")} disabled={Boolean(busy)} onClick={() => openOfficial("residencia", protocolId)}>
            {busy.startsWith("residencia:") ? "Preparando documento…" : "Declaração de residência (terceiro)"}
          </OfficialButton>
        </div>
      )}

      {pack?.ter.status === "unavailable" && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          TER específico deste protocolo: {pack.ter.reason} Use abaixo o TER oficial de outro protocolo, se for o caso.
        </p>
      )}
      {pack?.form.status === "unavailable" && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Formulário específico: {pack.form.reason}</p>
      )}

      {listAll && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Todos os TER oficiais (SESAB/nefrologia)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allTer.map((t) => (
              <button
                key={t.protocolId}
                type="button"
                className={t.protocolId === protocolId ? "btn-gold text-sm" : "btn-ghost text-sm"}
                disabled={Boolean(busy)}
                onClick={() => openOfficial("ter", t.protocolId)}
              >
                {busy === `ter:${t.protocolId}` ? "Preparando documento…" : t.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Formulários oficiais</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allForm.map((t) => (
              <button
                key={`form-${t.protocolId}`}
                type="button"
                className={t.protocolId === protocolId ? "btn-gold text-sm" : "btn-ghost text-sm"}
                disabled={Boolean(busy)}
                onClick={() => openOfficial("form", t.protocolId)}
              >
                {busy === `form:${t.protocolId}` ? "Preparando documento…" : t.label}
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={Boolean(busy)}
              onClick={() => openOfficial("residencia")}
            >
              Declaração de residência (terceiro)
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      {lastPdf && (
        <SignDocumentPanel
          compact
          pdfBlob={lastPdf.blob}
          filename={lastPdf.name}
          documentType={lastPdf.kind}
          title={`Documento oficial SESAB (${lastPdf.kind})`}
          patientKey={patientKey}
          signContext={{ patientName, patientCpf, doctorCrm: crm }}
        />
      )}
    </div>
  );
}

function OfficialButton({
  slot,
  busy,
  disabled,
  onClick,
  children,
}: {
  slot: OfficialDocSlot;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  if (slot.status !== "available") return null;
  return (
    <button type="button" className="btn-gold text-sm" onClick={onClick} disabled={disabled} aria-busy={busy}>
      {children}
    </button>
  );
}
