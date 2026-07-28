"use client";

import { useState } from "react";

function ckdEpi(creatinine: number, age: number, female: boolean, black: boolean) {
  // CKD-EPI 2009 (creatinine in mg/dL) — educational only
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
  if (egfr >= 45) return { label: "G3a", tip: "Diminuição leve a moderada", color: "text-yellow-300" };
  if (egfr >= 30) return { label: "G3b", tip: "Diminuição moderada a grave", color: "text-orange-300" };
  if (egfr >= 15) return { label: "G4", tip: "Diminuição grave", color: "text-orange-400" };
  return { label: "G5", tip: "Falência renal", color: "text-red-300" };
}

export default function EducacaoPage() {
  const [creatinine, setCreatinine] = useState("1.0");
  const [age, setAge] = useState("50");
  const [female, setFemale] = useState(false);
  const [black, setBlack] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  function calculate() {
    const egfr = ckdEpi(Number(creatinine), Number(age), female, black);
    setResult(egfr);
  }

  const st = result !== null ? stage(result) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Educação
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">
        Tempo também é rim
      </h1>
      <p className="mt-4 max-w-2xl text-[var(--text-soft)]">
        Conteúdo educativo sobre saúde renal e calculadora CKD-EPI para apoio —
        não substitui consulta com nefrologista.
      </p>

      <div className="panel mt-10">
        <h2 className="font-display text-2xl text-[var(--text)]">Calculadora CKD-EPI</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              Creatinina (mg/dL)
            </span>
            <input
              className="input-field"
              value={creatinine}
              onChange={(e) => setCreatinine(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              Idade
            </span>
            <input
              className="input-field"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFemale(false)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              !female ? "bg-[var(--gold)] text-[#111]" : "border border-[var(--border)]"
            }`}
          >
            Masculino
          </button>
          <button
            type="button"
            onClick={() => setFemale(true)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              female ? "bg-[var(--gold)] text-[#111]" : "border border-[var(--border)]"
            }`}
          >
            Feminino
          </button>
          <button
            type="button"
            onClick={() => setBlack((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              black ? "bg-[var(--gold)] text-[#111]" : "border border-[var(--border)]"
            }`}
          >
            Fator raça (CKD-EPI 2009)
          </button>
        </div>
        <button type="button" className="btn-gold mt-6" onClick={calculate}>
          Calcular TFG
        </button>
        {result !== null && st && (
          <div className="mt-6 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold-light)]">
              Resultado estimado
            </p>
            <p className="font-display mt-2 text-4xl text-[var(--gold-light)]">
              {result.toFixed(1)} mL/min/1,73m²
            </p>
            <p className={`mt-3 font-bold ${st.color}`}>
              Estágio {st.label} — {st.tip}
            </p>
          </div>
        )}
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Uso educativo. Para diagnóstico e conduta, agende uma teleconsulta.
        </p>
      </div>
    </div>
  );
}
