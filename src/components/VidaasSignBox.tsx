"use client";

import { useEffect, useState } from "react";
import { SIGNATURE_LINKS, VIDAAS_PREF_KEY } from "@/lib/signature-links";

type Props = {
  /** URL do PDF gerado no Meu Rim (abrir/baixar antes de assinar). */
  pdfHref?: string;
  pdfLabel?: string;
  /** Versão compacta (LME / compositor). */
  compact?: boolean;
  showPreference?: boolean;
  footnote?: string;
};

export function VidaasSignBox({
  pdfHref,
  pdfLabel = "Baixar PDF para assinar",
  compact = false,
  showPreference = false,
  footnote,
}: Props) {
  const [pref, setPref] = useState(false);
  useEffect(() => {
    try {
      setPref(localStorage.getItem(VIDAAS_PREF_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  function togglePref() {
    const next = !pref;
    setPref(next);
    try {
      localStorage.setItem(VIDAAS_PREF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={compact ? "mt-3" : ""}>
      {!compact && (
        <>
          <h2 className="font-display text-xl text-[var(--text)]">Assinar com VIDaaS</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            O VIDaaS (Valid) é certificado ICP-Brasil em nuvem. O Meu Rim gera o PDF; você assina no app, no
            VIDaaS Connect (computador) ou no Assinador gov.br com o mesmo certificado. A validade jurídica fica
            no PDF assinado — confira em validar.iti.gov.br.
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {pdfHref && (
          <a className="btn-gold text-sm" href={pdfHref} target="_blank" rel="noopener noreferrer">
            {pdfLabel}
          </a>
        )}
        <a className="btn-ghost text-sm" href={SIGNATURE_LINKS.vidaasInfo} target="_blank" rel="noopener noreferrer">
          Abrir VIDaaS / Connect
        </a>
        <a className="btn-ghost text-sm" href={SIGNATURE_LINKS.vidaasIos} target="_blank" rel="noopener noreferrer">
          App iPhone
        </a>
        <a className="btn-ghost text-sm" href={SIGNATURE_LINKS.vidaasAndroid} target="_blank" rel="noopener noreferrer">
          App Android
        </a>
        <a className="btn-ghost text-sm" href={SIGNATURE_LINKS.govAssinador} target="_blank" rel="noopener noreferrer">
          Assinador gov.br
        </a>
        <a className="btn-ghost text-sm" href={SIGNATURE_LINKS.validarIti} target="_blank" rel="noopener noreferrer">
          Validar assinatura
        </a>
      </div>
      {!compact && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--text-soft)]">
          <li>
            Tenha um e-CPF A3 em nuvem VIDaaS ativo. Médicos CRM podem emitir pela{" "}
            <a className="font-semibold text-[var(--gold)]" href={SIGNATURE_LINKS.cfmCertificado} target="_blank" rel="noopener noreferrer">
              AR do CFM
            </a>{" "}
            ou pela Valid.
          </li>
          <li>
            <b>No celular:</b> abra o app VIDaaS → certificado → Assinar documentos → escolha o PDF (até 7 MB) →
            confirme a biometria.
          </li>
          <li>
            <b>No Mac/PC:</b> instale o VIDaaS Connect na página oficial, leia o QR com o app, abra o PDF no
            Adobe e use Assinar digitalmente.
          </li>
          <li>
            <b>Pelo navegador:</b> baixe o PDF e envie no Assinador gov.br; o VIDaaS autentica no celular.
          </li>
        </ol>
      )}
      {showPreference && (
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-soft)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={pref} onChange={togglePref} />
          Uso VIDaaS neste aparelho (só um lembrete local — não envia seu certificado ao Meu Rim)
        </label>
      )}
      {compact && footnote && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">{footnote}</p>
      )}
      {!compact && (
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Assinar <b>dentro</b> do Meu Rim (sem baixar o arquivo) exige contrato de API com a Valid. Enquanto isso
          não existir, o caminho certo é: gerar no Meu Rim → assinar no VIDaaS/gov.br → o PDF assinado vale e pode
          ser anexado de volta ao prontuário.
        </p>
      )}
    </div>
  );
}
