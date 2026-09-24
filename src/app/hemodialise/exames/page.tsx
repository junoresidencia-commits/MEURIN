"use client";

import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_EXAM_LABEL, HD_EXAM_UNIT } from "@/lib/hd-labels";
import { HD_EXAM_CODES } from "@/lib/hd-types";

type Lab = {
  id: string;
  patientName: string;
  examLabel: string;
  rawValue: string;
  unit: string;
  confidence: number;
  status: string;
  source: string;
};

type Patient = { id: string; name: string };

export default function HdExamesPage() {
  const { year, month, can } = useHd();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [pending, setPending] = useState<Lab[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [exam, setExam] = useState("hb");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const u = new URLSearchParams({ view: "exams", year: String(year), month: String(month) });
    const [e, p] = await Promise.all([
      fetch(`/api/hemodialise?${u}`).then((r) => r.json()),
      fetch(`/api/hemodialise?view=patients&year=${year}&month=${month}`).then((r) => r.json()),
    ]);
    setLabs(e.labs || []);
    setPending(e.pending || []);
    setPatients(p.patients || []);
  }
  useEffect(() => { load(); }, [year, month]);

  async function addManual(ev: React.FormEvent) {
    ev.preventDefault();
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_labs", year, month, items: [{ patientId, exam, value, confidence: 100, source: "manual" }] }),
    });
    const d = await r.json();
    setMsg(d.error || `${d.created} resultado(s) registrado(s). A IA não prescreve.`);
    setValue("");
    await load();
  }

  async function upload(intent: string, file: File) {
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("file", file);
    fd.set("year", String(year));
    fd.set("month", String(month));
    const r = await fetch("/api/hemodialise/arquivo", { method: "POST", body: fd });
    const d = await r.json();
    setMsg(d.error || d.note || `Importados ${d.created ?? 0} resultados.`);
    await load();
  }

  async function confirm(labId: string, reject = false) {
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_lab", labId, reject }),
    });
    const d = await r.json();
    setMsg(d.error || (reject ? "Leitura rejeitada." : "Resultado confirmado."));
    await load();
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Exames</h2>
      <p className="text-sm text-[var(--text-muted)]">PDF, foto, CSV, XLSX ou digitação. O original é guardado. Confiança baixa exige confirmação.</p>

      {(can("upload_exams") || can("confirm_ocr")) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form onSubmit={addManual} className="panel grid gap-2">
            <p className="font-bold">Digitação manual</p>
            <select className="rounded-xl border border-[var(--border)] px-3 py-2" value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
              <option value="">Paciente</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="rounded-xl border border-[var(--border)] px-3 py-2" value={exam} onChange={(e) => setExam(e.target.value)}>
              {HD_EXAM_CODES.map((c) => <option key={c} value={c}>{HD_EXAM_LABEL[c]} ({HD_EXAM_UNIT[c]})</option>)}
            </select>
            <input className="rounded-xl border border-[var(--border)] px-3 py-2" placeholder="Resultado" value={value} onChange={(e) => setValue(e.target.value)} />
            <button className="btn-gold" type="submit">Registrar</button>
          </form>
          <div className="panel space-y-3">
            <p className="font-bold">Upload em lote</p>
            <label className="block text-sm">XLSX/CSV de resultados
              <input className="mt-1 block" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && upload("import_labs", e.target.files[0])} />
            </label>
            <label className="block text-sm">PDF, foto, JPG ou PNG (original)
              <input className="mt-1 block" type="file" accept=".pdf,image/*" multiple onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                Array.from(files).forEach((f) => upload("upload_exam", f));
              }} />
            </label>
            <p className="text-xs text-[var(--text-muted)]">Leitura automática não substitui o documento e nunca gera prescrição.</p>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-[var(--gold)]">{msg}</p>}

      {pending.length > 0 && (
        <div className="panel mt-4">
          <p className="font-bold">Confirmar resultado (baixa confiança)</p>
          {pending.map((l) => (
            <div key={l.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-2 text-sm">
              <p><strong>{l.patientName}</strong> · {l.examLabel}: {l.rawValue} {l.unit} · {l.confidence}%</p>
              <div className="flex gap-2">
                <button type="button" className="btn-gold" onClick={() => confirm(l.id)}>Confirmar</button>
                <button type="button" className="btn-ghost" onClick={() => confirm(l.id, true)}>Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--text-muted)]">
              <th className="px-2 py-2 text-left">Paciente</th>
              <th className="px-2 py-2 text-left">Exame</th>
              <th className="px-2 py-2 text-left">Resultado</th>
              <th className="px-2 py-2 text-left">Confiança</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {labs.map((l) => (
              <tr key={l.id} className="border-t border-[var(--border)]">
                <td className="px-2 py-2">{l.patientName}</td>
                <td className="px-2 py-2">{l.examLabel}</td>
                <td className="px-2 py-2">{l.rawValue} {l.unit}</td>
                <td className="px-2 py-2">{l.confidence}%</td>
                <td className="px-2 py-2">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
