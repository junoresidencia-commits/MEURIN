"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PatientNav } from "@/components/PatientNav";
import {
  EDU_HIGHLIGHTS,
  EDU_TOPICS,
  FIVE_NUMBERS,
  NORMAL_FLOW,
  RISK_FACTORS,
  NEPHRO_WHEN,
  EDU_QUOTES,
  type EduTopic,
} from "@/lib/kidney-education";

function shareLink(topic: EduTopic): string {
  const msg = `${topic.title}\n\n${topic.body.join("\n")}\n\n— via Meu Rim`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function Card({ topic, open }: { topic: EduTopic; open?: boolean }) {
  const [expanded, setExpanded] = useState(Boolean(open));
  return (
    <div id={topic.id} className="panel scroll-mt-4">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="font-semibold text-[var(--text)]">{topic.title}</span>
        <span className="text-[var(--gold)]">{expanded ? "–" : "+"}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--text-soft)]">
          {topic.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <a href={shareLink(topic)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)]">
            Compartilhar no WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

export default function EntenderPage() {
  useEffect(() => {
    const id = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (id) {
      const el = document.getElementById(id);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, []);

  return (
    <div className="mx-auto max-w-[620px] px-5 pb-28 pt-8">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">← Início</Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Entenda seu rim</h1>
      <p className="mt-2 text-[var(--text-soft)]">
        Cuidar do rim começa entendendo o rim. Um exame olha a função, outro procura lesão, outro olha
        a estrutura — juntos, eles contam a história dos seus rins.
      </p>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Conteúdo educativo. Não substitui consulta, nutricionista ou atendimento presencial.
      </p>

      {/* Destaques (mensagens mais importantes) */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Importante saber</h2>
      <div className="mt-3 space-y-3">
        {EDU_HIGHLIGHTS.map((t) => (
          <div key={t.id} id={t.id} className="scroll-mt-4 rounded-[20px] border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4">
            <p className="font-bold text-[var(--text)]">{t.title}</p>
            <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-[var(--text-soft)]">
              {t.body.map((p, i) => (<p key={i}>{p}</p>))}
            </div>
            <a href={shareLink(t)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-[var(--gold)]">Compartilhar no WhatsApp</a>
          </div>
        ))}
      </div>

      {/* Meus rins estão normais? */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Meus rins estão normais?</h2>
      <div className="mt-3 space-y-2">
        {NORMAL_FLOW.map((s, i) => (
          <div key={i} className="panel flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gold)] text-xs font-bold text-white">{i + 1}</span>
            <div>
              <p className="font-semibold text-[var(--text)]">{s.q}</p>
              <p className="text-sm text-[var(--text-soft)]">{s.a}</p>
            </div>
          </div>
        ))}
        <p className="rounded-2xl bg-[var(--bg-soft)] p-3 text-center text-sm font-semibold text-[var(--text)]">
          Nenhum exame isolado conta toda a história do rim.
        </p>
      </div>

      {/* Os números do rim */}
      <h2 id="numeros" className="mt-8 scroll-mt-4 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Os números do seu rim</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {FIVE_NUMBERS.map((n) => (
          <div key={n.n} className="panel flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-xs font-bold text-[var(--gold)]">{n.n}</span>
            <div>
              <p className="font-semibold text-[var(--text)]">{n.title}</p>
              <p className="text-sm text-[var(--text-soft)]">{n.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Escola do paciente */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Escola do paciente</h2>
      <div className="mt-3 space-y-2">
        {EDU_TOPICS.map((t) => (
          <Card key={t.id} topic={t} />
        ))}
      </div>

      {/* Risco + quando procurar nefrologista */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="panel">
          <p className="text-sm font-bold text-[var(--text)]">Quem tem maior risco de doença renal?</p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
            {RISK_FACTORS.map((r) => (<li key={r}>• {r}</li>))}
          </ul>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Ter um fator de risco não significa ter doença renal — apenas que pode ser importante avaliar os rins periodicamente.</p>
        </div>
        <div className="panel">
          <p className="text-sm font-bold text-[var(--text)]">Quando procurar um nefrologista?</p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
            {NEPHRO_WHEN.map((r) => (<li key={r}>• {r}</li>))}
          </ul>
        </div>
      </div>

      {/* Frases educativas */}
      <div className="mt-8 space-y-2">
        {EDU_QUOTES.map((q, i) => (
          <p key={i} className="rounded-2xl border border-[var(--border)] bg-white p-3 text-sm font-semibold text-[var(--text-soft)]">“{q}”</p>
        ))}
      </div>
      <PatientNav />
    </div>
  );
}
