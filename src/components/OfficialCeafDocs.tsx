"use client";

import { useState, type ReactNode } from "react";
import { getProtocolOfficialDocs, type OfficialDocKind, type OfficialDocSlot } from "@/lib/ceaf-documents";

const USER_ERROR = "Não foi possível localizar o documento oficial deste protocolo. Tente novamente ou informe o suporte.";

type Props = {
  protocolId: string;
  patientName?: string;
  doctorName?: string;
  crm?: string;
  patientCpf?: string;
  patientBirth?: string;
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

export function OfficialCeafDocs({ protocolId, patientName, doctorName, crm, patientCpf, patientBirth }: Props) {
  const pack = getProtocolOfficialDocs(protocolId);
  const [busy, setBusy] = useState<OfficialDocKind | "">("");
  const [error, setError] = useState("");

  async function openOfficial(doc: OfficialDocKind) {
    setBusy(doc);
    setError("");
    const params = new URLSearchParams({ protocol: protocolId, doc });
    if (doc === "ter") {
      if (patientName) params.set("name", patientName);
      if (doctorName) params.set("doctor", doctorName);
      if (crm) params.set("crm", crm);
      if (patientCpf) params.set("cpf", patientCpf);
      if (patientBirth) params.set("birth", patientBirth);
      params.set("date", new Date().toLocaleDateString("pt-BR"));
    }
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
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const filename = `${doc}-${protocolId}-oficial.pdf`;
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
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Documentos oficiais SESAB (páginas exatas — sem redesenho)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <OfficialButton slot={pack.ter} busy={busy === "ter"} disabled={Boolean(busy)} onClick={() => openOfficial("ter")}>
          {busy === "ter" ? "Preparando documento…" : "Baixar TER oficial (com nome)"}
        </OfficialButton>
        <OfficialButton slot={pack.form} busy={busy === "form"} disabled={Boolean(busy)} onClick={() => openOfficial("form")}>
          {busy === "form" ? "Preparando documento…" : "Baixar formulário oficial"}
        </OfficialButton>
        <OfficialButton slot={pack.residence} busy={busy === "residencia"} disabled={Boolean(busy)} onClick={() => openOfficial("residencia")}>
          {busy === "residencia" ? "Preparando documento…" : "Declaração de residência (terceiro)"}
        </OfficialButton>
      </div>
      {pack.ter.status === "unavailable" && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">TER: não aplicável neste pacote. {pack.ter.reason}</p>
      )}
      {pack.form.status === "unavailable" && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Formulário específico: não aplicável neste pacote. {pack.form.reason}</p>
      )}
      {error && (
        <p className="mt-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        A LME oficial é gerada no botão abaixo. TER e formulário só aparecem quando o arquivo oficial da SESAB existe neste protocolo.
      </p>
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
    <button type="button" className="btn-ghost text-sm" onClick={onClick} disabled={disabled} aria-busy={busy}>
      {children}
    </button>
  );
}
