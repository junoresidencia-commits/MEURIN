"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_ALERT_LABEL, HD_SHIFT_LABEL } from "@/lib/hd-labels";
import type { HdAlertLevel, HdShift } from "@/lib/hd-types";

type Row = {
  id: string;
  name: string;
  patientId: string | null;
  shift: HdShift | null;
  ward: string;
  machine: string;
  access: string;
  status: HdAlertLevel;
  alerts: number;
};

export default function HdPacientesPage() {
  const { year, month, shift, q, can } = useHd();
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const u = new URLSearchParams({ view: "patients", year: String(year), month: String(month), shift, q });
    fetch(`/api/hemodialise?${u}`).then((r) => r.json()).then((d) => setRows(d.patients || []));
  }, [year, month, shift, q]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_patient", name }),
    });
    const d = await r.json();
    if (d.error) setMsg(d.error);
    else {
      setName("");
      setMsg("Paciente incluído na ficha da Hemodiálise (sem duplicar cadastro do Meu Rim).");
      const u = new URLSearchParams({ view: "patients", year: String(year), month: String(month), shift, q });
      const n = await fetch(`/api/hemodialise?${u}`).then((x) => x.json());
      setRows(n.patients || []);
    }
  }

  async function link() {
    const r = await fetch("/api/hemodialise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link_patients" }) });
    const d = await r.json();
    setMsg(d.error || `Vinculados ${d.linked || 0} pacientes já existentes no Meu Rim.`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Pacientes</h2>
          <p className="text-sm text-[var(--text-muted)]">Ficha da Hemodiálise ligada ao cadastro do Meu Rim quando o nome coincide.</p>
        </div>
        {can("manage_config") && (
          <button type="button" className="btn-ghost" onClick={link}>Vincular cadastros existentes</button>
        )}
      </div>
      <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
        <input className="min-w-64 flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-sm" placeholder="Nome do paciente" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-gold" type="submit">Adicionar à Hemodiálise</button>
      </form>
      {msg && <p className="mt-2 text-sm text-[var(--gold)]">{msg}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-2 py-2">Paciente</th>
              <th className="px-2 py-2">Turno</th>
              <th className="px-2 py-2">Ala</th>
              <th className="px-2 py-2">Máq</th>
              <th className="px-2 py-2">Acesso</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-2 py-2">
                  <Link href={`/hemodialise/pacientes/${r.id}`} className="font-semibold text-[var(--gold)]">{r.name}</Link>
                  {!r.patientId && <span className="ml-2 text-[11px] text-[var(--text-muted)]">só HD</span>}
                </td>
                <td className="px-2 py-2">{r.shift ? HD_SHIFT_LABEL[r.shift] : "—"}</td>
                <td className="px-2 py-2">{r.ward || "—"}</td>
                <td className="px-2 py-2">{r.machine || "—"}</td>
                <td className="px-2 py-2">{r.access || "—"}</td>
                <td className="px-2 py-2">
                  <span className={r.status === "CRITICO" ? "font-bold text-[var(--danger)]" : r.status === "REVISAR" ? "font-semibold text-[var(--warn)]" : "text-[var(--green)]"}>
                    {HD_ALERT_LABEL[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
