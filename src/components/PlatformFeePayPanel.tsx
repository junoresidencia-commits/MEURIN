"use client";

import { useEffect, useState } from "react";

type Charge = {
  id: string;
  kind: string;
  amountCents: number;
  status: string;
  note?: string | null;
  createdAt: string;
};

type FeeData = {
  summary?: string;
  totals?: { dueCents: number; receivedCents: number; count: number };
  charges?: Charge[];
  pix?: {
    brCode: string;
    amountCents: number;
    holderName: string;
    adminEmail?: string;
    qrDataUrl?: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  due: "A pagar",
  declared: "Pago — aguardando admin",
  received: "Recebido pelo admin",
};

export function PlatformFeePayPanel({ endpoint }: { endpoint: string }) {
  const [data, setData] = useState<FeeData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(endpoint);
    if (!res.ok) return;
    setData(await res.json());
  }

  useEffect(() => {
    void load();
  }, [endpoint]);

  async function declarePaid() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível registrar.");
      setMsg("Avisamos o administrador. Ele confere o Pix na conta da plataforma.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const due = data.totals?.dueCents ?? 0;
  const received = data.totals?.receivedCents ?? 0;

  return (
    <section className="panel mt-4">
      <p className="text-sm font-semibold text-[var(--text)]">Repasse para a plataforma</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {data.summary || "O administrador define se o app é grátis ou quanto entra na conta da plataforma."}
      </p>
      <p className="mt-2 text-xs text-[var(--text-soft)]">
        Em aberto: <strong>R$ {(due / 100).toFixed(2)}</strong>
        {received > 0 ? ` · já recebido: R$ ${(received / 100).toFixed(2)}` : ""}
      </p>

      {data.pix && due > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">
            Pix para {data.pix.holderName}
            {data.pix.adminEmail ? ` · ${data.pix.adminEmail}` : ""}
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Valor: R$ {(data.pix.amountCents / 100).toFixed(2)}
          </p>
          {data.pix.qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.pix.qrDataUrl} alt="QR Pix da plataforma" className="mt-3 h-40 w-40 rounded-lg bg-white p-1" />
          )}
          <p className="mt-2 break-all text-xs text-[var(--text-soft)]">{data.pix.brCode}</p>
          <button type="button" className="btn-gold mt-3 text-sm" onClick={() => void declarePaid()} disabled={busy}>
            {busy ? "Registrando…" : "Já paguei a plataforma"}
          </button>
        </div>
      )}

      {due <= 0 && (data.charges?.length ?? 0) === 0 && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Nada a pagar agora.</p>
      )}

      {(data.charges?.length ?? 0) > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-[var(--text-soft)]">
          {data.charges!.slice(0, 8).map((c) => (
            <li key={c.id}>
              {c.kind === "entrada" ? "Entrada" : "Atendimento"}
              {c.note ? ` · ${c.note}` : ""} · R$ {(c.amountCents / 100).toFixed(2)} · {STATUS_LABEL[c.status] || c.status}
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </section>
  );
}
