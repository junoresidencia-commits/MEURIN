"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TemplatePicker } from "@/components/TemplatePicker";

type Doctor = {
  name: string;
  crm?: string;
  specialty?: string;
  rqe?: string;
  clinic?: string;
};

type Letterhead = { id: string; name: string; isDefault: boolean; active: boolean };

type DocType = "receita" | "exame" | "relatorio";

const TYPE_LABEL: Record<DocType, string> = {
  receita: "Receita médica",
  exame: "Solicitação de exames",
  relatorio: "Relatório médico",
};

const PLACEHOLDER: Record<DocType, string> = {
  receita: "Um item por linha. Ex.:\nLosartana 50mg — 1 comprimido pela manhã\nDapagliflozina 10mg — 1 comprimido ao dia",
  exame: "Um exame por linha. Ex.:\nCreatinina e ureia\nRelação albumina/creatinina (RAC)\nHemograma, potássio, HbA1c",
  relatorio: "Escreva o relatório médico.",
};

const NO_LETTERHEAD = "__none__";

export default function DocumentoAvulsoPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<DocType>("receita");
  const [patientName, setPatientName] = useState("");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [letterheadId, setLetterheadId] = useState<string>(NO_LETTERHEAD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [auth, lh] = await Promise.all([
        fetch("/api/auth").then((r) => r.json()),
        fetch("/api/doctor/letterheads").then((r) => r.json()).catch(() => ({ letterheads: [] })),
      ]);
      if (!auth.doctor) {
        router.replace("/medicos/login");
        return;
      }
      setDoctor(auth.doctor);
      const list: Letterhead[] = (lh.letterheads || []).filter((l: Letterhead) => l.active);
      setLetterheads(list);
      const def = list.find((l) => l.isDefault) || list[0];
      setLetterheadId(def ? def.id : NO_LETTERHEAD);
      setLoading(false);
    })();
  }, [router]);

  const dateLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const credential = doctor ? [doctor.crm, doctor.rqe ? `RQE ${doctor.rqe}` : ""].filter(Boolean).join(" · ") : "";

  async function generatePdf() {
    if (!doctor || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/documents/avulso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: TYPE_LABEL[type],
          content: body,
          patientName: patientName.trim(),
          letterheadId: letterheadId === NO_LETTERHEAD ? "" : letterheadId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Não foi possível gerar o documento.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  function shareWhatsApp() {
    const digits = phone.replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg = `${TYPE_LABEL[type]} — ${doctor?.name || "Meu Rim"}${patientName ? ` para ${patientName}` : ""}:\n\n${body}`;
    const url = withCountry
      ? `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading || !doctor) {
    return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Documento avulso</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Gere uma receita, pedido de exame ou relatório rápido — sem precisar abrir um paciente. Sai sobre o seu
        <b> papel timbrado</b> salvo, pronto para baixar, imprimir ou enviar no WhatsApp.
      </p>

      {letterheads.length === 0 && (
        <div className="panel mt-6 border-[var(--border-gold)] bg-[var(--gold-soft)]">
          <p className="font-semibold text-[var(--text)]">Adicione seu papel timbrado</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Envie o seu receituário (PDF, PNG ou JPG) uma vez e ele será usado em todos os documentos. Sem timbrado, o
            documento sai em papel branco com o seu nome no cabeçalho.
          </p>
          <Link href="/medicos/configuracoes/documentos" className="btn-gold mt-3 inline-block">Adicionar papel timbrado →</Link>
        </div>
      )}

      <div className="panel mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["receita", "exame", "relatorio"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${type === t ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Papel timbrado</span>
          <select className="input-field" value={letterheadId} onChange={(e) => setLetterheadId(e.target.value)}>
            {letterheads.map((l) => (
              <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " (padrão)" : ""}</option>
            ))}
            <option value={NO_LETTERHEAD}>Sem papel timbrado (papel branco)</option>
          </select>
          <span className="mt-1 block text-xs text-[var(--text-muted)]">
            Gerencie seus papéis em{" "}
            <Link href="/medicos/configuracoes/documentos" className="font-semibold text-[var(--gold)]">Configurações › Papéis timbrados</Link>.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome do paciente (opcional)</span>
          <input className="input-field" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Deixe em branco se não quiser identificar" />
        </label>
        <TemplatePicker type={type} currentText={body} onApply={setBody} patientName={patientName} />
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Conteúdo</span>
          <textarea className="input-field min-h-[160px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder={PLACEHOLDER[type]} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">WhatsApp do paciente (opcional, para enviar)</span>
          <input className="input-field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex.: 73999998888" />
        </label>
        {error && <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" onClick={generatePdf} disabled={busy || !body.trim()}>
            {busy ? "Gerando…" : "Gerar PDF (timbrado)"}
          </button>
          <button type="button" className="btn-ghost" onClick={shareWhatsApp} disabled={!body.trim()}>Enviar no WhatsApp</button>
        </div>
      </div>

      {/* Prévia do texto (o PDF final sai sobre o papel timbrado selecionado). */}
      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Prévia do conteúdo</p>
      <div className="mt-3 rounded-[16px] border border-[var(--border)] bg-white p-8 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <p className="font-display text-lg font-extrabold text-[var(--text)]">{doctor.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{[doctor.specialty, credential].filter(Boolean).join(" — ")}</p>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{dateLabel}</p>
        </div>
        {patientName.trim() && (
          <p className="mt-4 text-sm text-[var(--text-soft)]">Paciente: <b className="text-[var(--text)]">{patientName.trim()}</b></p>
        )}
        <h2 className="mt-6 text-center text-xl font-extrabold uppercase tracking-wide text-[var(--text)]">{TYPE_LABEL[type]}</h2>
        <div className="mt-6 min-h-[120px] whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text)]">
          {body || <span className="text-[var(--text-muted)]">O conteúdo aparecerá aqui…</span>}
        </div>
        <p className="mt-8 text-center text-[11px] text-[var(--text-muted)]">
          Prévia apenas do texto. Clique em <b>Gerar PDF (timbrado)</b> para o documento final sobre o seu papel timbrado.
        </p>
      </div>
    </div>
  );
}
