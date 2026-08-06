"use client";

import { useState } from "react";
import Link from "next/link";

function ckdEpi(creatinine: number, age: number, female: boolean, black: boolean) {
  // CKD-EPI 2009 (creatinina em mg/dL) — apoio educativo
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.329 : -0.411;
  const sexFactor = female ? 1.018 : 1;
  const raceFactor = black ? 1.159 : 1;
  const scrK = creatinine / kappa;
  const min = Math.min(scrK, 1);
  const max = Math.max(scrK, 1);
  return (
    141 *
    Math.pow(min, alpha) *
    Math.pow(max, -1.209) *
    Math.pow(0.993, age) *
    sexFactor *
    raceFactor
  );
}

function stage(egfr: number) {
  if (egfr >= 90) return { label: "G1", tip: "Normal ou elevada", color: "text-[var(--green)]" };
  if (egfr >= 60) return { label: "G2", tip: "Levemente diminuída", color: "text-[var(--green)]" };
  if (egfr >= 45) return { label: "G3a", tip: "Diminuição leve a moderada", color: "text-[#a47114]" };
  if (egfr >= 30) return { label: "G3b", tip: "Diminuição moderada a grave", color: "text-[#a47114]" };
  if (egfr >= 15) return { label: "G4", tip: "Diminuição grave", color: "text-[#c04b46]" };
  return { label: "G5", tip: "Falência renal", color: "text-[#c04b46]" };
}

const TOPICS = [
  {
    t: "O que é doença renal crônica (DRC)",
    d: "É a perda gradual da função dos rins ao longo do tempo. Muitas vezes não dá sintomas no início — por isso exames de rotina e o acompanhamento com nefrologista são importantes, principalmente para quem tem pressão alta, diabetes ou histórico familiar.",
  },
  {
    t: "Creatinina e TFGe",
    d: "A creatinina é medida no sangue e, junto com a idade e o sexo, permite estimar a TFGe (taxa de filtração glomerular). A TFGe indica o quanto os rins estão filtrando. Resultados alterados merecem avaliação de um nefrologista — não são diagnóstico por si só.",
  },
  {
    t: "Alimentação e os rins",
    d: "A depender do seu caso, pode ser preciso ajustar sódio, potássio, fósforo, proteínas e líquidos. Isso é individual: só um nutricionista, junto do seu médico, define o plano certo para você. Evite dietas por conta própria.",
  },
  {
    t: "Sinais para não ignorar",
    d: "Inchaço nas pernas, urina espumosa, pressão difícil de controlar, cansaço sem explicação ou exames alterados. Não é emergência automática, mas são motivos para procurar um nefrologista. Em dor forte, falta de ar ou desmaio, vá ao pronto-socorro.",
  },
];

export default function EducacaoPage() {
  const [creatinine, setCreatinine] = useState("1.0");
  const [age, setAge] = useState("50");
  const [female, setFemale] = useState(false);
  const [black, setBlack] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  function calculate() {
    setResult(ckdEpi(Number(creatinine), Number(age), female, black));
  }

  const st = result !== null ? stage(result) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm font-semibold text-[var(--gold)]">Saúde renal</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)] sm:text-4xl">
        Entenda seus rins
      </h1>
      <p className="mt-4 max-w-2xl text-[var(--text-soft)]">
        Conteúdo educativo sobre saúde renal e uma calculadora da função renal
        (CKD-EPI) para apoio. Nada aqui substitui a consulta — para avaliar de
        verdade, procure um <strong className="text-[var(--text)]">nefrologista</strong> e,
        para alimentação, um <strong className="text-[var(--text)]">nutricionista</strong>.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/agendar" className="btn-gold">Agendar com nefrologista</Link>
        <a href="#calculadora" className="btn-ghost">Calcular minha função renal</a>
      </div>

      {/* Calculadora */}
      <div id="calculadora" className="panel mt-10 scroll-mt-4">
        <h2 className="font-display text-2xl font-extrabold text-[var(--text)]">Calculadora de função renal (CKD-EPI)</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Estime sua TFGe a partir da creatinina. É apenas orientativo.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              Creatinina (mg/dL)
            </span>
            <input className="input-field" inputMode="decimal" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              Idade
            </span>
            <input className="input-field" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setFemale(false)} className={`rounded-full px-4 py-2 text-sm font-bold ${!female ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>
            Masculino
          </button>
          <button type="button" onClick={() => setFemale(true)} className={`rounded-full px-4 py-2 text-sm font-bold ${female ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>
            Feminino
          </button>
          <button type="button" onClick={() => setBlack((v) => !v)} className={`rounded-full px-4 py-2 text-sm font-bold ${black ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>
            Fator raça (CKD-EPI 2009)
          </button>
        </div>
        <button type="button" className="btn-gold mt-6" onClick={calculate}>
          Calcular TFG
        </button>
        {result !== null && st && (
          <div className="mt-6 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Resultado estimado</p>
            <p className="font-display mt-2 text-4xl font-extrabold text-[var(--gold)]">
              {result.toFixed(1)} mL/min/1,73m²
            </p>
            <p className={`mt-3 font-bold ${st.color}`}>Estágio {st.label} — {st.tip}</p>
            <p className="mt-4 text-sm text-[var(--text-soft)]">
              Esse número é uma estimativa e não fecha diagnóstico. Leve seus
              exames a um nefrologista para avaliação.
            </p>
            <Link href="/agendar" className="btn-gold mt-4 inline-flex">Falar com um nefrologista</Link>
          </div>
        )}
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Uso educativo. Para diagnóstico e conduta, procure um nefrologista.
        </p>
      </div>

      {/* Conteúdos educativos */}
      <h2 className="font-display mt-12 text-2xl font-extrabold text-[var(--text)]">Aprenda sobre seus rins</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <div key={topic.t} className="rounded-[22px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)]">
            <h3 className="text-base font-bold text-[var(--text)]">{topic.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{topic.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-[24px] border border-[var(--border-gold)] bg-[var(--gold-soft)] p-6">
        <h2 className="font-display text-xl font-extrabold text-[var(--text)]">Precisa avaliar seus rins?</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Agende uma consulta online com um nefrologista da Meu Rim. Se precisar de
          orientação alimentar, o nefrologista pode encaminhar a um nutricionista.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/agendar" className="btn-gold">Agendar consulta</Link>
          <Link href="/agendar?rapido=1" className="btn-ghost">Quero um horário próximo</Link>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
        Este conteúdo é educativo e não substitui avaliação médica. Em emergência,
        procure atendimento presencial.
      </p>
    </div>
  );
}
