"use client";

import Link from "next/link";

type Topic = { title: string; body: string };

const TOPICS: Topic[] = [
  { title: "Potássio", body: "O potássio é importante para os músculos e o coração. Nos rins com função reduzida, ele pode se acumular no sangue. Frutas, legumes, feijões e alguns tubérculos têm mais potássio — mas a quantidade que você pode comer depende dos seus exames e da orientação da sua equipe. Não corte alimentos por conta própria." },
  { title: "Fósforo", body: "O fósforo em excesso pode afetar ossos e vasos. Ele está em laticínios, carnes, feijões e, principalmente, em aditivos de alimentos ultraprocessados (procure ‘fosfato’/‘fósforo’ na lista de ingredientes). Alimentos com fósforo de aditivos costumam ser mais absorvidos." },
  { title: "Sódio (sal)", body: "O sódio ajuda a controlar a pressão e o inchaço. A maior parte vem do sal de adição e de ultraprocessados (embutidos, temperos prontos, enlatados). Prefira temperos naturais (alho, cebola, ervas, limão) e confira o sódio no rótulo por porção." },
  { title: "Proteínas", body: "As proteínas são essenciais, mas a quantidade ideal varia conforme o estágio da doença renal e se você faz diálise. Quem está em diálise costuma precisar de mais proteína; no tratamento conservador, a quantidade pode ser ajustada. Sua nutricionista define a sua meta." },
  { title: "Água e líquidos", body: "A quantidade de líquidos depende da sua diurese, do inchaço e do tipo de tratamento. Nem todo mundo precisa restringir. Siga a orientação individual da equipe e registre também sopas, gelatinas e frutas muito aguadas quando indicado." },
  { title: "Como ler rótulos", body: "Olhe sempre a porção de referência e compare com o quanto você realmente come. Verifique sódio por porção e procure aditivos de fósforo e potássio na lista de ingredientes (ex.: ‘fosfato’, ‘cloreto de potássio’)." },
  { title: "Ultraprocessados", body: "Alimentos ultraprocessados costumam ter muito sódio, aditivos de fósforo e potássio. Não precisam ser proibidos, mas devem ser ocasionais. Prefira comida de verdade, preparada em casa, sempre que possível." },
  { title: "Alimentação na doença renal", body: "A alimentação faz parte do tratamento e é individual: depende do diagnóstico, do estágio, dos exames e da presença de diálise. O aplicativo ajuda a registrar e estimar — mas as metas e ajustes são definidos pela sua equipe (médico e nutricionista)." },
];

const SOURCES = [
  { label: "Sociedade Brasileira de Nefrologia (SBN)", url: "https://www.sbn.org.br/" },
  { label: "Ministério da Saúde — Guia Alimentar", url: "https://www.gov.br/saude/pt-br" },
  { label: "TBCA — Tabela Brasileira de Composição de Alimentos (USP)", url: "http://www.tbca.net.br/" },
];

export default function NutricaoEducacaoPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/paciente/nutricao" className="text-sm font-semibold text-[var(--gold)]">← Meu diário</Link>
      <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">Entenda sua alimentação e seus rins</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Conteúdo educativo, em linguagem simples. Não substitui a orientação da sua equipe.</p>

      <div className="mt-5 space-y-3">
        {TOPICS.map((t) => (
          <details key={t.title} className="panel">
            <summary className="cursor-pointer font-semibold text-[var(--text)]">{t.title}</summary>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">{t.body}</p>
          </details>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Fontes</p>
        <ul className="mt-2 space-y-1 text-sm">
          {SOURCES.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--gold)]">{s.label} ↗</a></li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Materiais das entidades citadas. Em caso de dúvida, procure sempre sua equipe de saúde.</p>
      </div>
    </div>
  );
}
