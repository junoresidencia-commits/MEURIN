"use client";

import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HdExamDocsPanel } from "@/components/hd/HdExamDocsPanel";
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
  collectedAt?: string | null;
};

type Patient = { id: string; name: string };

type ParsedItem = {
  exam: string;
  examCode: string;
  value: string;
  unit: string;
  date?: string;
  confidence: number;
};

export default function HdExamesPage() {
  const { year, month, can } = useHd();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [pending, setPending] = useState<Lab[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [exam, setExam] = useState("hb");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [paste, setPaste] = useState("");
  const [hold, setHold] = useState<{ items: ParsedItem[]; fileId?: string; source: string } | null>(null);
  const [docsTick, setDocsTick] = useState(0);

  async function load() {
    const u = new URLSearchParams({ view: "exams", year: String(year), month: String(month) });
    const [e, p] = await Promise.all([
      fetch(`/api/hemodialise?${u}`).then((r) => r.json()),
      fetch(`/api/hemodialise?view=patients&year=${year}&month=${month}`).then((r) => r.json()),
    ]);
    setLabs(e.labs || []);
    setPending(e.pending || []);
    setPatients(p.patients || []);
    setDocsTick((n) => n + 1);
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

  async function upload(intent: string, file?: File, text?: string, assignPatient?: string) {
    setBusy(intent);
    setMsg(file ? "Lendo a imagem/PDF e identificando nome e exames…" : "Identificando exames…");
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("year", String(year));
    fd.set("month", String(month));
    if (file) fd.set("file", file);
    if (text) fd.set("text", text);
    if (assignPatient) fd.set("patientId", assignPatient);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 40000);
    try {
      const r = await fetch("/api/hemodialise/arquivo", { method: "POST", body: fd, signal: ctrl.signal });
      const d = await r.json();
      if (d.error) {
        setMsg(d.error);
        return;
      }
      setMsg(d.note || `Importados ${d.created ?? 0} resultados.`);
      if (d.needsPatient && Array.isArray(d.items) && d.items.length) {
        setHold({ items: d.items, fileId: d.file?.id, source: intent === "upload_exam" ? "pdf" : "ocr" });
      } else {
        setHold(null);
        setPaste("");
      }
      await load();
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setMsg(
        aborted
          ? "A leitura travou e foi interrompida. Tente uma foto mais nítida ou cole o texto do laudo."
          : "Não deu para ler agora. Tente de novo ou cole o texto."
      );
    } finally {
      window.clearTimeout(timer);
      setBusy("");
    }
  }

  async function assignHeld() {
    if (!hold || !patientId) return;
    setBusy("assign");
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_labs",
        year,
        month,
        items: hold.items.map((it) => ({
          ...it,
          patientId,
          fileId: hold.fileId,
          source: hold.source,
        })),
      }),
    });
    const d = await r.json();
    setBusy("");
    setMsg(d.error || `Lancei ${d.created ?? 0} exame(s) neste paciente.`);
    if (!d.error) setHold(null);
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

  async function confirmAll() {
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_pending", year, month }),
    });
    const d = await r.json();
    setMsg(d.error || `Confirmados ${d.confirmed ?? 0} resultado(s).`);
    await load();
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Exames</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Mande o <b>PDF</b> ou a <b>foto/print</b> do laudo. O Meu Rim identifica exame, data e lança de uma vez.
        Depois disso, já aparece a opinião do protocolo e a LME pronta (CNS, CNES, medicamento oficial e quantidade do mapa).
        Confiança baixa pede confirmação. Não inventa valor e não muda prescrição.
      </p>

      {(can("upload_exams") || can("confirm_ocr")) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="panel space-y-3">
            <p className="font-bold">PDF, foto ou print</p>
            <label className="block text-sm">
              Arquivo do laudo (pode mandar vários)
              <input
                className="mt-1 block w-full"
                type="file"
                accept=".pdf,image/*"
                multiple
                disabled={Boolean(busy)}
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach((f) => void upload("upload_exam", f, undefined, patientId || undefined));
                  e.target.value = "";
                }}
              />
            </label>
            <label className="block text-sm">
              Paciente (se o nome não vier no laudo)
              <select className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Detectar pelo nome no laudo</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Ou cole o texto do laudo
              <textarea
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                rows={4}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"15/09/2026\nHemoglobina 10,2\nFósforo 5,4\nPTH 480\nUreia pré 142\nUreia pós 48"}
              />
            </label>
            <button
              type="button"
              className="btn-gold"
              disabled={busy === "paste_labs" || !paste.trim()}
              onClick={() => void upload("paste_labs", undefined, paste, patientId || undefined)}
            >
              {busy === "paste_labs" ? "Lendo…" : "Identificar e lançar"}
            </button>
            <label className="block text-sm text-[var(--text-muted)]">
              Planilha XLSX/CSV
              <input className="mt-1 block" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && upload("import_labs", e.target.files[0])} />
            </label>
          </div>
          <form onSubmit={addManual} className="panel grid gap-2">
            <p className="font-bold">Um exame avulso (se precisar)</p>
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
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-[var(--gold)]">{msg}</p>}

      {hold && (
        <div className="panel mt-4 border-2 border-[var(--border-gold)]">
          <p className="font-bold">Exames lidos — falta o paciente</p>
          <ul className="mt-2 space-y-1 text-sm">
            {hold.items.map((it, i) => (
              <li key={`${it.examCode}-${i}`}>{it.exam}: <strong>{it.value}</strong> {it.unit}{it.date ? ` · ${it.date}` : ""}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select className="rounded-xl border border-[var(--border)] px-3 py-2" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Selecione o paciente</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn-gold" disabled={!patientId || busy === "assign"} onClick={() => void assignHeld()}>
              {busy === "assign" ? "Lançando…" : "Lançar nestes exames"}
            </button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="panel mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">Confirmar leitura ({pending.length})</p>
            {can("confirm_ocr") && (
              <button type="button" className="btn-gold" onClick={() => void confirmAll()}>Confirmar todos</button>
            )}
          </div>
          {pending.map((l) => (
            <div key={l.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-2 text-sm">
              <p><strong>{l.patientName}</strong> · {l.examLabel}: {l.rawValue} {l.unit}{l.collectedAt ? ` · ${l.collectedAt}` : ""} · {l.confidence}%</p>
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
              <th className="px-2 py-2 text-left">Data</th>
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
                <td className="px-2 py-2">{l.collectedAt || "—"}</td>
                <td className="px-2 py-2">{l.confidence}%</td>
                <td className="px-2 py-2">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HdExamDocsPanel tick={docsTick} />
    </div>
  );
}
