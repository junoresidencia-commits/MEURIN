"use client";

import { useCallback, useEffect, useState } from "react";
import { NFSE_STATUS_LABEL } from "@/lib/clinic-cash-labels";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Item = {
  encounter: {
    id: string;
    clinicId: string;
    feeCents: number;
    receivedCents: number;
    paymentStatus: string;
    attendedAt: string;
  };
  payment: { method: string | null; methodLabel: string; status: string; statusLabel: string };
  recibo: { id: string; number: string | null; status: string } | null;
  nfse: { status: string; statusLabel: string; id: string | null; number: string | null };
};
type Doc = {
  id: string;
  kind: string;
  status: string;
  number: string | null;
  amountCents: number;
  serviceLabel: string;
  createdAt: string;
  pdfPath: string | null;
};

export function PatientFinancePanel({ emailParam }: { emailParam: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [nfseConfigured, setNfseConfigured] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/doctor/patients/${encodeURIComponent(emailParam)}/financeiro`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não carregou o financeiro.");
        setItems(d.items || []);
        setDocs(d.docs || []);
        setNfseConfigured(Boolean(d.nfseConfigured));
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [emailParam]);

  useEffect(() => { load(); }, [load]);

  async function act(action: "recibo" | "nfse_request", encounterId?: string) {
    setBusy(action + (encounterId || ""));
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${encodeURIComponent(emailParam)}/financeiro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, encounterId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível.");
      if (action === "recibo") setMsg(`Recibo ${d.doc?.number || ""} gerado.`);
      else if (d.queued) setMsg("Solicitação na fila da gestão financeira. Não é Nota Fiscal ainda.");
      else if (d.autoIssued) setMsg("NFS-e emitida.");
      else setMsg("Solicitação registrada.");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy("");
    }
  }

  function fileUrl(docId: string) {
    return `/api/doctor/patients/${encodeURIComponent(emailParam)}/financeiro/${docId}/arquivo`;
  }

  async function share(docId: string) {
    const url = `${window.location.origin}${fileUrl(docId)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Documento financeiro", url });
        return;
      } catch {
        /* usuário cancelou */
      }
    }
    await navigator.clipboard.writeText(url);
    setMsg("Link copiado.");
  }

  return (
    <div className="space-y-3">
      <div className="panel">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Financeiro e documentos fiscais</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Recibo sai daqui. Nota Fiscal de Serviço (NFS-e) só existe com emissão válida
          {nfseConfigured ? "." : " — por enquanto a solicitação vai para a fila da clínica."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-gold" disabled={Boolean(busy)} onClick={() => act("recibo", items[0]?.encounter.id)}>
            Gerar Recibo
          </button>
          <button type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={() => act("nfse_request", items[0]?.encounter.id)}>
            {nfseConfigured ? "Gerar Nota Fiscal" : "Solicitar emissão de nota"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setHistoryOpen((v) => !v)}>
            Visualizar documentos anteriores
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-[var(--gold)]">{msg}</p>}
        {err && <p className="mt-2 text-sm text-[var(--danger)]">{err}</p>}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">Ainda não há atendimento de clínica vinculado a este paciente.</p>
      )}
      {items.map((it) => (
        <div key={it.encounter.id} className="panel space-y-1">
          <p className="font-bold">Consulta · {brl(it.encounter.receivedCents || it.encounter.feeCents)}</p>
          <p className="text-sm">Pagamento · {it.payment.methodLabel} · {it.payment.statusLabel}</p>
          <p className="text-sm">Recibo · {it.recibo ? `Emitido ${it.recibo.number || ""}` : "Não emitido"}</p>
          <p className="text-sm">Nota fiscal · {it.nfse.statusLabel}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {new Date(it.encounter.attendedAt).toLocaleString("pt-BR")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost text-sm" disabled={Boolean(busy)} onClick={() => act("recibo", it.encounter.id)}>
              Gerar recibo deste atendimento
            </button>
            <button type="button" className="btn-ghost text-sm" disabled={Boolean(busy)} onClick={() => act("nfse_request", it.encounter.id)}>
              {nfseConfigured ? "Gerar NFS-e" : "Solicitar nota"}
            </button>
            {it.recibo && (
              <>
                <a className="btn-ghost text-sm" href={fileUrl(it.recibo.id)} target="_blank" rel="noreferrer">Visualizar</a>
                <a className="btn-ghost text-sm" href={fileUrl(it.recibo.id)} download>Baixar</a>
                <button type="button" className="btn-ghost text-sm" onClick={() => window.open(fileUrl(it.recibo!.id), "_blank")}>Imprimir</button>
                <button type="button" className="btn-ghost text-sm" onClick={() => share(it.recibo!.id)}>Compartilhar</button>
              </>
            )}
          </div>
        </div>
      ))}

      {historyOpen && (
        <div className="panel space-y-2">
          <p className="font-bold">Documentos anteriores</p>
          {docs.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum documento ainda.</p>}
          {docs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
              <div>
                <p className="text-sm font-semibold">{d.kind === "recibo" ? "Recibo" : "NFS-e"} {d.number || ""}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {brl(d.amountCents)} · {d.kind === "recibo" ? "Emitido" : (NFSE_STATUS_LABEL[d.status] || d.status)} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {d.pdfPath && (
                <a className="text-sm font-semibold text-[var(--gold)]" href={fileUrl(d.id)} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
