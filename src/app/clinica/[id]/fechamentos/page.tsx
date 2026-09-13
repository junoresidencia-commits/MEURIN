"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Member = { actorId: string; actorKind: string; name: string };
type Closing = {
  id: string;
  code: string;
  doctorName: string;
  periodFrom: string;
  periodTo: string;
  producedCents: number;
  receivedCents: number;
  netCents: number;
  status: string;
};
type Preview = {
  encounterCount: number;
  producedCents: number;
  receivedCents: number;
  pendingCents: number;
  doctorShareCents: number;
  existing: { id: string; code: string } | null;
  warnings: string[];
};

export default function FechamentosPage() {
  const params = useParams<{ id: string }>();
  const [doctors, setDoctors] = useState<Member[]>([]);
  const [rows, setRows] = useState<Closing[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  function load() {
    fetch(`/api/clinica/${params.id}/invite`)
      .then((r) => r.json())
      .then((d) => {
        const docs = (d.members || []).filter((m: Member) => (m as { actorKind: string }).actorKind === "doctor");
        setDoctors(docs);
        if (!doctorId && docs[0]) setDoctorId(docs[0].actorId);
      })
      .catch(() => {});
    fetch(`/api/clinica/${params.id}/fechamentos`)
      .then((r) => r.json())
      .then((d) => setRows(d.closings || []))
      .catch(() => {});
  }
  useEffect(() => { load(); }, [params.id]);

  async function conferir() {
    setErr("");
    setMsg("");
    setLoadingPreview(true);
    try {
      const q = new URLSearchParams({ preview: "1", doctorId, periodFrom: from, periodTo: to });
      const res = await fetch(`/api/clinica/${params.id}/fechamentos?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível conferir.");
      setPreview(data.preview);
    } catch (e) {
      setPreview(null);
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!preview) {
      await conferir();
      return;
    }
    if (preview.existing) {
      setErr(`Já existe um fechamento para este médico e período (${preview.existing.code}).`);
      return;
    }
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/clinica/${params.id}/fechamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, periodFrom: from, periodTo: to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível fechar.");
      setMsg(`Fechamento ${data.closing.code} gerado.`);
      setPreview(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  const doctorName = doctors.find((d) => d.actorId === doctorId)?.name || "Médico";

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Fechamentos</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Conferir primeiro. Nunca gerar pagamento sem ver os números. Código <b>MED-AAAA-######</b>.
      </p>
      <form onSubmit={create} className="panel mt-5 grid gap-3 sm:grid-cols-4">
        <select className="input-field min-h-12" value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setPreview(null); }} required>
          <option value="">Médico</option>
          {doctors.map((d) => <option key={d.actorId} value={d.actorId}>{d.name}</option>)}
        </select>
        <input className="input-field min-h-12" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} required />
        <input className="input-field min-h-12" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} required />
        <button type="button" className="btn-ghost min-h-12" disabled={loadingPreview || !doctorId || !from || !to} onClick={conferir}>
          {loadingPreview ? "Conferindo…" : "Conferir atendimentos"}
        </button>
        {msg && <p className="sm:col-span-4 text-sm text-[var(--gold)]">{msg}</p>}
        {err && <p className="sm:col-span-4 text-sm text-[var(--danger)]">{err}</p>}
      </form>

      {preview && (
        <div className="panel mt-4 space-y-2">
          <p className="font-bold">{doctorName}</p>
          <p className="text-sm text-[var(--text-soft)]">
            {preview.encounterCount} atendimentos · Produção {brl(preview.producedCents)} · Recebido {brl(preview.receivedCents)} · Pendente {brl(preview.pendingCents)} · Repasse previsto {brl(preview.doctorShareCents)}
          </p>
          {preview.warnings.map((w) => (
            <p key={w} className="text-sm text-[var(--danger)]">{w}</p>
          ))}
          {preview.existing ? (
            <Link href={`/clinica/${params.id}/fechamentos/${preview.existing.id}`} className="btn-gold inline-block min-h-12 px-4 py-3">
              Abrir fechamento existente ({preview.existing.code})
            </Link>
          ) : (
            <button type="button" className="btn-gold min-h-12" disabled={saving || preview.encounterCount === 0} onClick={() => create({ preventDefault() {} } as React.FormEvent)}>
              {saving ? "Gerando…" : "Gerar fechamento"}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum fechamento ainda.</p>}
        {rows.map((c) => (
          <Link key={c.id} href={`/clinica/${params.id}/fechamentos/${c.id}`} className="panel block">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">{c.code}</p>
              <p className="text-xs font-semibold text-[var(--gold)]">{c.status === "paid" ? "Repasse pago" : "Fechado"}</p>
            </div>
            <p className="text-sm text-[var(--text-soft)]">{c.doctorName} · {c.periodFrom} a {c.periodTo}</p>
            <p className="mt-1 text-sm">Produção {brl(c.producedCents)} · recebido {brl(c.receivedCents)} · líquido {brl(c.netCents)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
