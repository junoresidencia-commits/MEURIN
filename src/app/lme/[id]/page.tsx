"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { receitaFromLme, relatorioFromLme, composerHref } from "@/lib/complementary-docs";

type Med = { name: string; presentation?: string; monthlyQty?: string };
type Lme = {
  id: string;
  patientEmail?: string | null;
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
  const [copied, setCopied] = useState(false);
  const [isDoctor, setIsDoctor] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const officialUrl = `/api/lme/${id}/oficial`;

  function printOficial() {
    const win = frameRef.current?.contentWindow;
    if (win) {
      try { win.focus(); win.print(); return; } catch { /* fallback abaixo */ }
    }
    window.open(officialUrl, "_blank");
  }
  function shareWhatsapp() {
    if (!lme) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const msg = `LME de ${lme.patientName || "paciente"} — abra e baixe o PDF oficial: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }
  function copyLink() {
    if (typeof window === "undefined") return;
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  useEffect(() => {
    fetch(`/api/lme/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro");
        setLme(data.lme);
      })
      .catch((e) => setError(e.message));
    // Só o médico logado vê os "Documentos complementares" (ações do médico).
    fetch("/api/auth").then((r) => r.json()).then((d) => setIsDoctor(Boolean(d?.doctor))).catch(() => {});
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
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">LME OFICIAL — SESAB/CEAF</p>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Formulário oficial preenchido</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" onClick={printOficial}>Imprimir</button>
          <a className="btn-ghost" href={officialUrl} target="_blank" rel="noopener noreferrer" download="lme-oficial.pdf">Baixar PDF</a>
          <button type="button" className="btn-ghost" onClick={shareWhatsapp}>WhatsApp</button>
          <button type="button" className="btn-ghost" onClick={copyLink}>{copied ? "Link copiado!" : "Copiar link"}</button>
        </div>
      </div>
      <p className="mb-3 rounded-xl border border-[var(--warn)]/30 bg-[#fff7e8] px-3 py-2 text-xs text-[#7a5a12] print:hidden">
        Este é o <b>formulário oficial da SESAB</b> pré-preenchido (o arquivo oficial não é alterado — só os campos são preenchidos).
        Revise a seleção do medicamento e a grade de quantidades por mês antes de assinar. Fica salvo no prontuário do paciente.
      </p>

      {/* PDF OFICIAL preenchido — conteúdo principal (impressão/print sai deste PDF) */}
      <div className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-white shadow-[var(--shadow)] print:hidden">
        <iframe ref={frameRef} title="LME oficial preenchida" src={officialUrl} className="h-[82vh] w-full" />
      </div>

      {/* Documentos complementares — só para o médico logado. NÃO altera a LME. */}
      {isDoctor && lme.patientEmail && (
        <section className="mt-6 rounded-[16px] border border-[var(--border-gold)] bg-[var(--gold-soft)] p-5 shadow-[var(--shadow)] print:hidden">
          <h2 className="font-display text-lg font-extrabold text-[var(--text)]">Documentos complementares</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            A partir desta LME, gere a <b>Receita</b> e o <b>Relatório médico</b> já pré-preenchidos com os dados do paciente e do medicamento.
            Você edita o texto, confere no papel timbrado e assina — a LME oficial <b>não é alterada</b>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={composerHref(lme.patientEmail, receitaFromLme(lme), lme.id)} className="btn-gold">Gerar Receita</Link>
            <Link href={composerHref(lme.patientEmail, relatorioFromLme(lme), lme.id)} className="btn-ghost">Gerar Relatório Médico</Link>
          </div>
          <div className="mt-3 border-t border-[var(--border-gold)]/60 pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Pacote (LME + Receita + Relatório)</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Junta a LME oficial com a Receita e o Relatório já gerados em PDF, num único arquivo para baixar ou imprimir.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`/api/lme/${lme.id}/pacote?download=1`} target="_blank" rel="noopener noreferrer" className="btn-gold text-sm">Baixar pacote (PDF)</a>
              <a href={`/api/lme/${lme.id}/pacote`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">Abrir / imprimir pacote</a>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Dica: no compositor você pode salvar prescrições/relatórios como <b>modelo</b> e reutilizar nas próximas LME (padrões do médico).
          </p>
        </section>
      )}

      {/* Assinatura digital (ICP-Brasil / gov.br) */}
      <section className="mt-6 rounded-[16px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)] print:hidden">
        <h2 className="font-display text-lg font-extrabold text-[var(--text)]">Assinatura digital</h2>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          O campo <b>17 — Assinatura e carimbo do médico</b> fica em branco de propósito. Assine de um destes jeitos:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--text-soft)]">
          <li><b>Assinatura digital (recomendado)</b>: baixe o PDF final abaixo e assine com o seu certificado ICP‑Brasil pelo <b>gov.br</b> (Assinador do gov.br) ou pela ferramenta do seu certificado. A assinatura vale juridicamente e pode ser conferida no <b>validar.iti.gov.br</b>.</li>
          <li><b>À mão</b>: imprima e assine/carimbe no campo 17.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn-gold" href={`${officialUrl}?flatten=1`} target="_blank" rel="noopener noreferrer">Baixar PDF para assinar digitalmente</a>
          <a className="btn-ghost" href="https://assinador.iti.br/" target="_blank" rel="noopener noreferrer">Abrir Assinador gov.br</a>
          <a className="btn-ghost" href="https://validar.iti.gov.br/" target="_blank" rel="noopener noreferrer">Validar assinatura</a>
        </div>
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
          O PDF baixado para assinatura é a versão <b>final e não editável</b> (campos “achatados”), para a assinatura cobrir o documento inteiro.
          Assinatura automática em nuvem (certificado ICP‑Brasil integrado ao app) fica disponível quando um provedor de certificado em nuvem for contratado e configurado.
        </p>
      </section>

      {/* Resumo dos dados — uso interno, NÃO é a LME oficial */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--text-muted)] print:hidden">
          Ver resumo dos dados (uso interno — não é a LME oficial)
        </summary>
        <div className="mt-2 flex flex-wrap justify-end gap-2 print:hidden">
          <button type="button" className="btn-ghost" onClick={downloadPdf}>Baixar resumo interno</button>
        </div>
      <div className="mt-2 rounded-[16px] border border-[var(--border)] bg-white p-8 shadow-[var(--shadow)]">
        <p className="text-center text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Componente Especializado (CEAF)</p>
        <h2 className="mt-1 text-center text-lg font-extrabold text-[var(--text)]">Resumo dos dados (uso interno)</h2>
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
          Resumo interno gerado pela plataforma Meu Rim — não substitui a LME oficial da SESAB.
        </p>
      </div>
      </details>
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
