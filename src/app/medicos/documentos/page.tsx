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
  logoUrl?: string | null;
};

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function DocumentoAvulsoPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<DocType>("receita");
  const [patientName, setPatientName] = useState("");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!d.doctor) {
          router.replace("/medicos/login");
          return;
        }
        setDoctor(d.doctor);
        setLoading(false);
      });
  }, [router]);

  const dateLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const credential = doctor ? [doctor.crm, doctor.rqe ? `RQE ${doctor.rqe}` : ""].filter(Boolean).join(" · ") : "";

  async function downloadPdf() {
    if (!doctor) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    let textX = margin;
    if (doctor.logoUrl) {
      try {
        const img = await loadImage(doctor.logoUrl);
        const maxH = 46;
        const maxLogoW = 150;
        const ratio = img.width / img.height || 1;
        let h = maxH;
        let w = h * ratio;
        if (w > maxLogoW) {
          w = maxLogoW;
          h = w / ratio;
        }
        const fmt = doctor.logoUrl.includes("image/png") ? "PNG" : "JPEG";
        pdf.addImage(doctor.logoUrl, fmt, margin, y - 6, w, h);
        textX = margin + w + 12;
      } catch {
        /* segue sem logo */
      }
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(doctor.name, textX, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    pdf.text([doctor.specialty, credential].filter(Boolean).join(" — "), textX, y + 15);
    pdf.text(dateLabel, pageW - margin, y, { align: "right" });
    pdf.setTextColor(20);
    y += 40;
    pdf.setDrawColor(210);
    pdf.line(margin, y, pageW - margin, y);
    y += 30;

    if (patientName.trim()) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(80);
      pdf.text(`Paciente: ${patientName.trim()}`, margin, y);
      pdf.setTextColor(20);
      y += 24;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(TYPE_LABEL[type].toUpperCase(), pageW / 2, y, { align: "center" });
    y += 30;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(body || "", maxW) as string[];
    for (const line of lines) {
      if (y > 720) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 20;
    }

    y = Math.max(y + 60, 700);
    pdf.line(margin + 120, y, pageW - margin - 120, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(doctor.name, pageW / 2, y + 16, { align: "center" });
    if (credential) {
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(120);
      pdf.text(credential, pageW / 2, y + 32, { align: "center" });
    }

    pdf.save(`${type}-meu-rim.pdf`);
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
      <div className="print:hidden">
        <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Documento avulso</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Gere uma receita, pedido de exame ou relatório rápido — sem precisar abrir um paciente. Sai
          com a sua identidade e logo, pronto para baixar em PDF, imprimir ou enviar no WhatsApp.
        </p>

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
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-gold" onClick={downloadPdf} disabled={!body.trim()}>Baixar PDF</button>
            <button type="button" className="btn-ghost" onClick={() => window.print()} disabled={!body.trim()}>Imprimir</button>
            <button type="button" className="btn-ghost" onClick={shareWhatsApp} disabled={!body.trim()}>Enviar no WhatsApp</button>
          </div>
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Pré-visualização</p>
      </div>

      {/* Documento (também é o que sai na impressão) */}
      <div className="mt-3 rounded-[16px] border border-[var(--border)] bg-white p-8 shadow-[var(--shadow)] print:mt-0 print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            {doctor.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doctor.logoUrl} alt="Logo" className="h-12 max-w-[160px] object-contain" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gold)] text-sm font-extrabold text-white">
                {doctor.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <p className="font-display text-lg font-extrabold text-[var(--text)]">{doctor.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{[doctor.specialty, credential].filter(Boolean).join(" — ")}</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{dateLabel}</p>
        </div>

        {patientName.trim() && (
          <p className="mt-4 text-sm text-[var(--text-soft)]">Paciente: <b className="text-[var(--text)]">{patientName.trim()}</b></p>
        )}

        <h2 className="mt-6 text-center text-xl font-extrabold uppercase tracking-wide text-[var(--text)]">
          {TYPE_LABEL[type]}
        </h2>

        <div className="mt-6 min-h-[120px] whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text)]">
          {body || <span className="text-[var(--text-muted)]">O conteúdo aparecerá aqui…</span>}
        </div>

        <div className="mt-16 border-t border-[var(--text)] pt-2 text-center">
          <p className="font-semibold text-[var(--text)]">{doctor.name}</p>
          {credential && <p className="text-sm text-[var(--text-muted)]">{credential}</p>}
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--text-muted)]">
          Documento emitido pela plataforma Meu Rim. Em emergência, procure atendimento presencial.
        </p>
      </div>
    </div>
  );
}
