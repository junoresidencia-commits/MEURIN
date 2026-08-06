"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Med = { name: string; presentation?: string; monthlyQty?: string };
type Lme = {
  id: string;
  doctorName?: string | null;
  doctorCrm?: string | null;
  doctorCns?: string | null;
  establishmentName?: string | null;
  cnes?: string | null;
  patientName?: string | null;
  motherName?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  patientCpf?: string | null;
  patientCns?: string | null;
  patientPhone?: string | null;
  race?: string | null;
  cid10?: string | null;
  diagnosis?: string | null;
  anamnesis?: string | null;
  priorTreatment: boolean;
  priorTreatmentDesc?: string | null;
  incapable: boolean;
  responsibleName?: string | null;
  medications: Med[];
  createdAt: string;
};

export default function LmePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [lme, setLme] = useState<Lme | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/lme/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro");
        setLme(data.lme);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--danger)]">{error}</div>;
  if (!lme) return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  const date = new Date(lme.createdAt).toLocaleDateString("pt-BR");

  async function downloadPdf() {
    if (!lme) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const W = pdf.internal.pageSize.getWidth();
    const M = 48;
    let y = M;
    const line = (t: string, size = 10, bold = false, gap = 15) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(size);
      for (const l of pdf.splitTextToSize(t, W - 2 * M) as string[]) {
        if (y > 800) { pdf.addPage(); y = M; }
        pdf.text(l, M, y);
        y += gap;
      }
    };
    line("LAUDO DE SOLICITAÇÃO, AVALIAÇÃO E AUTORIZAÇÃO DE MEDICAMENTO(S)", 12, true, 16);
    line("Componente Especializado da Assistência Farmacêutica (CEAF) — Meu Rim", 9, false, 18);
    line(`Data da solicitação: ${date}`, 10, false, 18);
    line("Estabelecimento / CNES", 10, true);
    line(`${lme.establishmentName || "—"}   CNES: ${lme.cnes || "—"}`, 10, false, 18);
    line("Paciente", 10, true);
    line(`Nome: ${lme.patientName || "—"}`);
    line(`Nome da mãe: ${lme.motherName || "—"}`);
    line(`CPF: ${lme.patientCpf || "—"}   CNS: ${lme.patientCns || "—"}`);
    line(`Peso: ${lme.weightKg ?? "—"} kg   Altura: ${lme.heightCm ?? "—"} cm   Raça/cor: ${lme.race || "—"}`);
    line(`Telefone: ${lme.patientPhone || "—"}`, 10, false, 18);
    line("Diagnóstico e CID-10", 10, true);
    line(`CID-10: ${lme.cid10 || "—"}`);
    line(`Diagnóstico: ${lme.diagnosis || "—"}`, 10, false, 18);
    line("Anamnese", 10, true);
    line(lme.anamnesis || "—", 10, false, 15);
    line("", 10, false, 6);
    line(`Tratamento prévio: ${lme.priorTreatment ? "SIM — " + (lme.priorTreatmentDesc || "") : "NÃO"}`);
    line(`Paciente incapaz: ${lme.incapable ? "SIM — Responsável: " + (lme.responsibleName || "") : "NÃO"}`, 10, false, 18);
    line("Medicamento(s) solicitado(s)", 10, true);
    lme.medications.forEach((m, i) => {
      line(`${i + 1}. ${m.name} ${m.presentation || ""} — Qtde/mês: ${m.monthlyQty || "—"}`);
    });
    y += 30;
    pdf.line(M + 100, y, W - M - 100, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(lme.doctorName || "Médico solicitante", W / 2, y + 15, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120);
    pdf.text(`${lme.doctorCrm || ""}   CNS: ${lme.doctorCns || "—"}`, W / 2, y + 30, { align: "center" });
    pdf.save(`lme-meu-rim.pdf`);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden">
        <a className="btn-gold" href={`/api/lme/${id}/oficial`}>Baixar PDF OFICIAL preenchido</a>
        <button type="button" className="btn-ghost" onClick={downloadPdf}>Baixar resumo</button>
        <button type="button" className="btn-ghost" onClick={() => window.print()}>Imprimir</button>
      </div>
      <p className="mb-4 rounded-xl border border-[var(--warn)]/30 bg-[#fff7e8] px-3 py-2 text-xs text-[#7a5a12] print:hidden">
        O PDF oficial vem pré-preenchido com os dados. Revise no formulário do Ministério
        a seleção do medicamento (lista oficial) e a grade de quantidades por mês antes de assinar.
      </p>
      <div className="rounded-[16px] border border-[var(--border)] bg-white p-8 shadow-[var(--shadow)]">
        <p className="text-center text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Componente Especializado (CEAF)</p>
        <h1 className="mt-1 text-center text-lg font-extrabold text-[var(--text)]">Laudo de Solicitação de Medicamento(s) — LME</h1>
        <p className="mt-1 text-center text-xs text-[var(--text-muted)]">Data: {date}</p>

        <Section title="Estabelecimento">
          <Field label="Nome" value={lme.establishmentName} />
          <Field label="CNES" value={lme.cnes} />
        </Section>
        <Section title="Paciente">
          <Field label="Nome" value={lme.patientName} />
          <Field label="Nome da mãe" value={lme.motherName} />
          <Field label="CPF" value={lme.patientCpf} />
          <Field label="CNS" value={lme.patientCns} />
          <Field label="Peso" value={lme.weightKg ? `${lme.weightKg} kg` : null} />
          <Field label="Altura" value={lme.heightCm ? `${lme.heightCm} cm` : null} />
          <Field label="Raça/cor" value={lme.race} />
          <Field label="Telefone" value={lme.patientPhone} />
        </Section>
        <Section title="Diagnóstico">
          <Field label="CID-10" value={lme.cid10} />
          <Field label="Diagnóstico" value={lme.diagnosis} />
        </Section>
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Anamnese</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-soft)]">{lme.anamnesis || "—"}</p>
        </div>
        <Section title="Situação">
          <Field label="Tratamento prévio" value={lme.priorTreatment ? `SIM — ${lme.priorTreatmentDesc || ""}` : "NÃO"} />
          <Field label="Paciente incapaz" value={lme.incapable ? `SIM — ${lme.responsibleName || ""}` : "NÃO"} />
        </Section>
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Medicamento(s)</p>
          {lme.medications.map((m, i) => (
            <p key={i} className="mt-1 text-sm text-[var(--text)]">
              {i + 1}. <b>{m.name}</b> {m.presentation} — Qtde/mês: {m.monthlyQty || "—"}
            </p>
          ))}
        </div>
        <div className="mt-12 border-t border-[var(--text)] pt-2 text-center">
          <p className="font-semibold text-[var(--text)]">{lme.doctorName}</p>
          <p className="text-sm text-[var(--text-muted)]">{lme.doctorCrm} · CNS {lme.doctorCns || "—"}</p>
        </div>
        <p className="mt-6 text-center text-[11px] text-[var(--text-muted)]">
          Documento gerado pela plataforma Meu Rim. Confira as exigências da unidade responsável.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{title}</p>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">{children}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <p className="text-sm text-[var(--text-soft)]">
      <span className="text-[var(--text-muted)]">{label}:</span> {value || "—"}
    </p>
  );
}
