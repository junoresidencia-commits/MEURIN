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

export default function FechamentosPage() {
  const params = useParams<{ id: string }>();
  const [doctors, setDoctors] = useState<Member[]>([]);
  const [rows, setRows] = useState<Closing[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
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
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Fechamentos</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Gera o código único <b>MED-AAAA-######</b>, o PDF da produção e o comprovante de repasse. Não mexe no prontuário.
      </p>
      <form onSubmit={create} className="panel mt-5 grid gap-3 sm:grid-cols-4">
        <select className="input-field" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
          <option value="">Médico</option>
          {doctors.map((d) => <option key={d.actorId} value={d.actorId}>{d.name}</option>)}
        </select>
        <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
        <button type="submit" className="btn-gold" disabled={saving}>{saving ? "Fechando…" : "Gerar fechamento"}</button>
        {msg && <p className="sm:col-span-4 text-sm text-[var(--gold)]">{msg}</p>}
        {err && <p className="sm:col-span-4 text-sm text-[var(--danger)]">{err}</p>}
      </form>
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
